"use server";

import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "./prisma";
import { UserWithDocuments } from "./types";

export async function fetchUserForSidebar(email: string): Promise<{ name: string | null; isAdmin: boolean } | null> {
    noStore();
    try {
        const user = await prisma.user.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } },
            select: { name: true, isAdmin: true }
        });
        return user;
    } catch (error) {
        console.error("Sidebar User Fetch Error:", error);
        return null;
    }
}

export async function fetchUserWithDocuments(email: string): Promise<UserWithDocuments | null> {
    noStore();
    try {
        const user = await prisma.user.findFirst({
            where: { 
                email: {
                    equals: email,
                    mode: 'insensitive',
                }
            },
            include: {
                ownedDocuments: {
                    include: {
                        versions: {
                            orderBy: {
                                versionNumber: 'desc',
                            },
                        },

                        sharedWith: {
                            include: {
                                user: {
                                    select: { 
                                        name: true,
                                        email: true,
                                    }
                                }
                            }
                        }
                    },
                    orderBy: {
                        updatedAt: "desc",
                    },
                },
                sharedDocuments: {
                    include: { 
                        document: {
                            include: {
                                owner: true,
                                versions: {
                                    orderBy: {
                                        versionNumber: 'desc',
                                    },
                                },
                            },
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