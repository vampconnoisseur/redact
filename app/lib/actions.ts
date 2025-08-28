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

// Initialize the S3 Client
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
        return { message: "Not authenticated." };
    }

    const UploadSchema = z.object({
        file: z
            .instanceof(File)
            .refine((file) => file.size > 0, "File is required.")
            .refine(
                (file) => file.type === "application/pdf",
                "Only PDF files are allowed."
            ),
    });

    const validatedFields = UploadSchema.safeParse({
        file: formData.get("file"),
    });

    if (!validatedFields.success) {
        return { message: "Invalid file." };
    }

    const { file } = validatedFields.data;

    // Generate a unique key for the S3 object to prevent overwrites
    const key = `${session.user.id}/${randomUUID()}-${file.name}`;

    try {
        // Convert file to a buffer to be sent to S3
        const buffer = Buffer.from(await file.arrayBuffer());

        const putObjectCommand = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: file.type,
        });

        await s3Client.send(putObjectCommand);

        // Now, create the database record with the S3 key
        await prisma.document.create({
            data: {
                fileName: file.name,
                s3Key: key,
                ownerId: session.user.id,
            },
        });

        revalidatePath("/dashboard");
        return { message: "Document uploaded successfully." };
    } catch (error) {
        console.error("S3 Upload Error:", error);
        return { message: "Failed to upload document." };
    }
}

/**
 * Generates a secure, temporary URL to view a document.
 */
export async function getPresignedUrl(key: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        throw new Error("Not authenticated");
    }

    // You might add an extra check here to ensure the current user
    // actually has permission to view this key.

    try {
        const getObjectCommand = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
        });

        // The URL will be valid for 60 seconds
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
    // This function does not need changes, it's already correct.
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return { message: "Not authenticated." };
    }

    const ShareSchema = z.object({
        email: z.string().email("Invalid email address."),
        documentId: z.string().min(1, "Document ID is required."),
    });

    const validatedFields = ShareSchema.safeParse({
        email: formData.get("email"),
        documentId: formData.get("documentId"),
    });

    if (!validatedFields.success) {
        return { message: "Invalid data provided." };
    }

    const { email, documentId } = validatedFields.data;

    try {
        const userToShareWith = await prisma.user.findUnique({
            where: { email },
        });
        if (!userToShareWith) {
            return { message: "User with that email does not exist." };
        }
        if (userToShareWith.id === session.user.id) {
            return { message: "You cannot share a document with yourself." };
        }
        await prisma.sharedDocument.create({
            data: { documentId: documentId, userId: userToShareWith.id },
        });

        revalidatePath("/dashboard");
        return { message: `Document shared with ${email}.` };
    } catch (error) {
        if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            (error as { code: unknown }).code === "P2002"
        ) {
            return {
                message:
                    "This document has already been shared with this user.",
            };
        }
        console.error("Share Error:", error);
        return { message: "Failed to share document." };
    }
}
