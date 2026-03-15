"use server";

import { prisma } from "./prisma";
import { authOptions } from "./auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { KMSClient, EncryptCommand, DecryptCommand } from "@aws-sdk/client-kms";
import { randomUUID } from "crypto";
import { encrypt, decrypt } from "./crypto";

console.log("DEBUG AWS_REGION:", process.env.AWS_REGION);
console.log("DEBUG AWS_KMS:", process.env.AWS_KMS_KEY_ID);
console.log("DEBUG AWS_KEY_LENGTH:", process.env.AWS_ACCESS_KEY_ID?.length);

const s3Client = new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

const kmsClient = new KMSClient({
    region: process.env.AWS_REGION!,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME!;
const KMS_KEY_ID = process.env.AWS_KMS_KEY_ID!;

export async function uploadNewVersion(prevState: unknown, formData: FormData) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, message: "Not authenticated." };

    const file = formData.get("file") as File;
    const engine = formData.get("engine") as "classic" | "llm";
    const displayName = formData.get("displayName") as string;
    const documentId = formData.get("documentId") as string | null;

    if (!file || !engine || !displayName) return { success: false, message: "Missing required fields." };
    
    const apiBaseUrl = process.env.PYTHON_API_BASE_URL?.replace(/\/$/, ""); 
    const pythonFormData = new FormData();
    pythonFormData.append("file", file);
    pythonFormData.append("severity", "100");
    pythonFormData.append("engine", engine);
    
    
    let pythonResponse;
    try {
        const response = await fetch(`${apiBaseUrl}/process/`, { method: "POST", body: pythonFormData });
        if (!response.ok) throw new Error(await response.text());
        pythonResponse = await response.json();
    } catch (error) {
        console.error("Python API Error:", error);
        return { success: false, message: "Failed to process document." };
    }

    const { decryptionKey, encryptedMetadata, redactedFile, contentType } = pythonResponse;
    
    let encryptedKeyForDb = "";
    try {
        const encryptCommand = new EncryptCommand({
            KeyId: KMS_KEY_ID,
            Plaintext: Buffer.from(decryptionKey, 'utf-8'),
        });
        const kmsResponse = await kmsClient.send(encryptCommand);
        if (!kmsResponse.CiphertextBlob) throw new Error("No ciphertext returned from KMS");
        
        encryptedKeyForDb = Buffer.from(kmsResponse.CiphertextBlob).toString('base64');
    } catch (error) {
        console.error("KMS Encryption Error:", error);
        return { success: false, message: "Failed to secure the document key via KMS." };
    }

    const key = `${session.user.id}/${randomUUID()}-${file.name}`;
    
    try {
        const buffer = Buffer.from(redactedFile, 'base64');
        const command = new PutObjectCommand({ Bucket: BUCKET_NAME, Key: key, Body: buffer, ContentType: contentType });
        await s3Client.send(command);
    } catch (error) {
        console.error("S3 Upload Error:", error);
        return { success: false, message: "Failed to upload document." };
    }

    try {
        let doc;

        if (documentId) {
            doc = await prisma.document.findUnique({
                where: { id: documentId, ownerId: session.user.id },
            });

            if (!doc) {
                return { success: false, message: "Document group not found or you don't have permission." };
            }
            
            await prisma.document.update({
                where: { id: documentId },
                data: { updatedAt: new Date() },
            });
        } else {
            doc = await prisma.document.upsert({
                where: { ownerId_displayName: { ownerId: session.user.id, displayName } },
                update: { updatedAt: new Date() }, 
                create: { ownerId: session.user.id, displayName },
            });
        }

        const latestVersion = await prisma.documentVersion.findFirst({
            where: { documentId: doc.id },
            orderBy: { versionNumber: 'desc' },
        });

        await prisma.documentVersion.create({
            data: {
                documentId: doc.id,
                versionNumber: (latestVersion?.versionNumber || 0) + 1,
                fileName: file.name,
                s3Key: key,
                decryptionKey: encryptedKeyForDb,
                redactionData: encryptedMetadata,
                engineUsed: engine.toUpperCase() as "CLASSIC" | "LLM",
            },
        });
        
        revalidatePath("/mydocuments");
        return { success: true, message: "New version uploaded successfully." };
    } catch (error) {
        console.error("Database Error:", error);
        return { success: false, message: "Failed to save document version." };
    }
}

export async function getPresignedUrl(s3Key: string) { 
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        throw new Error("Not authenticated");
    }

    try {
        const getObjectCommand = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3Key,
        });

        const url = await getSignedUrl(s3Client, getObjectCommand, {
            expiresIn: 60,
        });
        return { url };
    } catch (error) {
        console.error("Error generating presigned URL", error);
        return { error: "Could not get document URL" };
    }
}

export async function shareDocument(prevState: unknown, formData: FormData) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, message: "Not authenticated." };

    const email = formData.get("email") as string;
    const documentId = formData.get("documentId") as string;
    const accessLevel = formData.get("accessLevel") as "REDACTED" | "ORIGINAL";
    const password = formData.get("password") as string | null;

    const userToShareWith = await prisma.user.findFirst({ 
        where: { email: { equals: email, mode: 'insensitive' } }
    });
    if (!userToShareWith) return { success: false, message: "User not found." };
    
    let encryptedPassword: string | null = null;
    if (accessLevel === 'ORIGINAL' && password) {
        encryptedPassword = encrypt(password);
    }

    try {
        await prisma.sharedDocument.upsert({
            where: { documentId_userId: { documentId, userId: userToShareWith.id } },
            update: { accessLevel, passwordHash: encryptedPassword },
            create: { documentId, userId: userToShareWith.id, accessLevel, passwordHash: encryptedPassword },
        });
        revalidatePath("/mydocuments");
        revalidatePath("/shared");
        return { success: true, message: `Document shared successfully.` };
    } catch {
        return { success: false, message: "Failed to share document." };
    }
}

export async function unredactAndDownload(documentId: string, versionId: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return { success: false, error: "Not authenticated." };
    }
    const userId = session.user.id;

    const document = await prisma.document.findUnique({
        where: { id: documentId },
    });
    if (!document) {
        return { success: false, error: "Document not found." };
    }
    
    const version = await prisma.documentVersion.findUnique({ where: { id: versionId } });
    if (!version) {
        return { success: false, error: "Version not found." };
    }

    const isOwner = document.ownerId === userId;
    let passwordForPdf: string | undefined = undefined;

    if (!isOwner) {
        const share = await prisma.sharedDocument.findUnique({
            where: { documentId_userId: { documentId, userId: userId } },
        });

        if (!share || share.accessLevel !== 'ORIGINAL') {
            return { success: false, error: "Access denied. You do not have permission to download the original document." };
        }
        
        if (share.passwordHash) {
            if (share.passwordHash.startsWith("$")) {
                console.error("Attempted to decrypt a legacy password hash. The document must be re-shared to update its password format.");
                return { 
                    success: false, 
                    error: "This document's password format is outdated. Please ask the owner to share it with you again to fix this issue." 
                };
            }

            try {
                passwordForPdf = decrypt(share.passwordHash);
            } catch (error) {
                console.error("Failed to decrypt password:", error);
                return { success: false, error: "Could not prepare document for download due to a security key issue." };
            }
        }
    }

    let plaintextDecryptionKey = "";
    try {
        const decryptCommand = new DecryptCommand({
            CiphertextBlob: Buffer.from(version.decryptionKey, 'base64'),
        });
        const kmsResponse = await kmsClient.send(decryptCommand);
        if (!kmsResponse.Plaintext) throw new Error("No plaintext returned from KMS");
        
        plaintextDecryptionKey = Buffer.from(kmsResponse.Plaintext).toString('utf-8');
    } catch (error) {
        console.error("KMS Decryption Error:", error);
        return { success: false, error: "Failed to unlock document: KMS decryption failed. Make sure the document was uploaded using the KMS flow." };
    }
    
    let s3FileBuffer: ArrayBuffer;
    try {
        const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: version.s3Key });
        const response = await s3Client.send(command);
        s3FileBuffer = (await response.Body!.transformToByteArray()).slice().buffer;
    } catch (error) {
        console.error("S3 Download Error:", error);
        return { success: false, error: "Could not retrieve document." };
    }

    const apiBaseUrl = process.env.PYTHON_API_BASE_URL?.replace(/\/$/, "");
    const pythonFormData = new FormData();
    pythonFormData.append("file", new Blob([s3FileBuffer]), version.fileName);
    
    pythonFormData.append("decryption_key", plaintextDecryptionKey); 
    pythonFormData.append("encrypted_metadata_json", JSON.stringify(version.redactionData));
    
    if (passwordForPdf) {
        pythonFormData.append("password", passwordForPdf);
    }

    try {
        const response = await fetch(`${apiBaseUrl}/unredact/`, { method: "POST", body: pythonFormData });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || "Unredaction failed");
        }

        const restoredFileBlob = await response.blob();
        const restoredFileBuffer = Buffer.from(await restoredFileBlob.arrayBuffer());

        return {
            success: true,
            fileData: restoredFileBuffer.toString('base64'),
            fileName: `restored_${version.fileName}`,
            contentType: restoredFileBlob.type,
        };
    } catch (error) {
        console.error("Unredact Error:", error);
        return { success: false, error: `Failed to restore document: ${error instanceof Error ? error.message : "Unknown error"}` };
    }
}

export async function deleteDocument(documentId: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return { success: false, error: "Not authenticated." };
    }
    const userId = session.user.id;

    const document = await prisma.document.findUnique({
        where: { id: documentId, ownerId: userId },
        include: { versions: { select: { s3Key: true } } }, 
    });

    if (!document) {
        return { success: false, error: "Document not found or you do not have permission to delete it." };
    }

    if (document.versions.length > 0) {
        try {
            const keysToDelete = document.versions.map(v => ({ Key: v.s3Key }));
            const deletePromises = keysToDelete.map(key => 
                s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key.Key }))
            );
            await Promise.all(deletePromises);
        } catch (error) {
            console.error("S3 Deletion Error:", error);
            return { success: false, error: "Failed to delete document files from storage." };
        }
    }

    try {
        await prisma.document.delete({ where: { id: documentId } });
        revalidatePath("/mydocuments");
        return { success: true };
    } catch (error) {
        console.error("Database Deletion Error:", error);
        return { success: false, error: "Failed to delete the document from the database." };
    }
}

export async function removeSharedDocument(documentId: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return { success: false, error: "Not authenticated." };
    }
    const userId = session.user.id;

    try {
        await prisma.sharedDocument.delete({
            where: {
                documentId_userId: {
                    documentId: documentId,
                    userId: userId,
                },
            },
        });
        revalidatePath("/shared");
        return { success: true };
    } catch (error) {
        console.error("Remove Share Error:", error);
        return { success: false, error: "Failed to remove the shared document." };
    }
}