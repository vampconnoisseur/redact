"use server";

import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "./prisma";

export async function fetchUserWithDocuments(email: string) {
    noStore();
    try {
        const user = await prisma.user.findUnique({
            where: { email },
            include: {
                ownedDocuments: {
                    orderBy: {
                        createdAt: "desc",
                    },
                },
                sharedDocuments: {
                    include: {
                        document: {
                            include: {
                                owner: true,
                            },
                        },
                    },
                    orderBy: {
                        document: {
                            createdAt: "desc",
                        },
                    },
                },
            },
        });
        return user;
    } catch (error) {
        console.error("Database Error:", error);
        throw new Error("Failed to fetch user and documents.");
    }
}
