"use server";

import { prisma } from "./prisma";
import { z } from "zod";
import { authOptions } from "./auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const s3Client = new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME!;

export async function uploadDocument(prevState: unknown, formData: FormData) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return { success: false, message: "Not authenticated." };
    }

    const file = formData.get("file") as File;
    if (!file || file.size === 0) {
        return { success: false, message: "A file is required." };
    }

    const apiBaseUrl = process.env.PYTHON_API_BASE_URL;
    const pythonFormData = new FormData();
    pythonFormData.append("file", file);
    pythonFormData.append("severity", "40");

    let pythonResponse;
    try {
        const response = await fetch(`${apiBaseUrl}/redact-encrypt/`, {
            method: "POST",
            body: pythonFormData,
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Python API Error: ${error.detail || response.statusText}`);
        }
        pythonResponse = await response.json();
    } catch (error) {
        console.error("Error calling Python API:", error);
        return { success: false, message: "Failed to process document with redaction service." };
    }

    const { decryptionKey, encryptedMetadata, redactedFile, contentType } = pythonResponse;

    const key = `${session.user.id}/${randomUUID()}-${file.name}`;
    try {
        const buffer = Buffer.from(redactedFile, 'base64');
        const putObjectCommand = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: contentType,
        });
        await s3Client.send(putObjectCommand);
    } catch (error) {
        console.error("S3 Upload Error:", error);
        return { success: false, message: "Failed to upload redacted document." };
    }

    try {
        await prisma.document.create({
            data: {
                fileName: file.name,
                s3Key: key,
                ownerId: session.user.id,
                decryptionKey: decryptionKey,
                redactionData: encryptedMetadata,
            },
        });

        revalidatePath("/dashboard");
        return { success: true, message: "Document redacted and uploaded successfully." };
    } catch (error) {
        console.error("Database Error:", error);
        return { success: false, message: "Failed to save document metadata." };
    }
}

export async function getPresignedUrl(key: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        throw new Error("Not authenticated");
    }

    try {
        const getObjectCommand = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
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
    if (!session?.user?.id) {
        return { success: false, message: "Not authenticated." };
    }

    const ShareSchema = z.object({
        email: z.string().email("Invalid email address."),
        documentId: z.string().min(1),
        accessLevel: z.enum(["REDACTED", "ORIGINAL"]),
    });

    const validatedFields = ShareSchema.safeParse({
        email: formData.get("email"),
        documentId: formData.get("documentId"),
        accessLevel: formData.get("accessLevel"),
    });

    if (!validatedFields.success) {
        return { success: false, message: "Invalid data provided." };
    }
    const { email, documentId, accessLevel } = validatedFields.data;

    try {
        const userToShareWith = await prisma.user.findUnique({ where: { email } });

        if (!userToShareWith) return { success: false, message: "User with that email does not exist." };
        if (userToShareWith.id === session.user.id) return { success: false, message: "You cannot share a document with yourself." };
        
        await prisma.sharedDocument.upsert({
            where: { documentId_userId: { documentId, userId: userToShareWith.id } },
            update: { accessLevel },
            create: { documentId, userId: userToShareWith.id, accessLevel },
        });

        revalidatePath("/dashboard");

        return { success: true, message: `Document shared with ${email} with ${accessLevel.toLowerCase()} access.` };
    } catch (error) {
        console.error("Share Error:", error);
        return { success: false, message: "Failed to share document." };
    }
}

export async function unredactAndDownloadDocument(documentId: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return { success: false, error: "Not authenticated." };
    }

    const sharePermission = await prisma.sharedDocument.findUnique({
        where: {
            documentId_userId: { documentId, userId: session.user.id },
        },
    });

    if (sharePermission?.accessLevel !== 'ORIGINAL') {
        return { success: false, error: "You do not have permission to download the original document." };
    }

    const document = await prisma.document.findUnique({
        where: { id: documentId },
    });
    if (!document) {
        return { success: false, error: "Document not found." };
    }

    let s3FileBuffer: ArrayBuffer;
    try {
        const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: document.s3Key });
        const response = await s3Client.send(command);
        const byteArray = await response.Body!.transformToByteArray();

        s3FileBuffer = byteArray.slice().buffer;

    } catch (error) {
        console.error("S3 Download Error:", error);
        return { success: false, error: "Could not retrieve document from storage." };
    }
    
    const apiBaseUrl = process.env.PYTHON_API_BASE_URL;
    const pythonFormData = new FormData();
    pythonFormData.append("file", new Blob([s3FileBuffer]), document.fileName);
    pythonFormData.append("decryption_key", document.decryptionKey);
    pythonFormData.append("encrypted_metadata_json", JSON.stringify(document.redactionData));
    
    try {
        const response = await fetch(`${apiBaseUrl}/unredact/`, {
            method: "POST",
            body: pythonFormData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Python API Error: ${error.detail || response.statusText}`);
        }

        const restoredFileBlob = await response.blob();
        const restoredFileBuffer = Buffer.from(await restoredFileBlob.arrayBuffer());

        return {
            success: true,
            fileData: restoredFileBuffer.toString('base64'),
            fileName: `restored_${document.fileName}`,
            contentType: restoredFileBlob.type,
        };
    } catch (error) {
        console.error("Unredact Error:", error);
        return { success: false, error: "Failed to restore the document." };
    }
}