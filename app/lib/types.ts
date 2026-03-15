import { Prisma } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type DocumentVersionWithRelations = Prisma.DocumentVersionGetPayload<{}>;

export const documentWithVersions = Prisma.validator<Prisma.DocumentDefaultArgs>()({
  include: { 
    versions: true,
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
  }
});

export type DocumentWithVersions = Prisma.DocumentGetPayload<typeof documentWithVersions>;

export const sharedDocumentWithRelations = Prisma.validator<Prisma.SharedDocumentDefaultArgs>()({
    include: {
        document: {
            include: {
                owner: true,
                versions: true
            }
        }
    }
});
export type SharedDocumentWithRelations = Prisma.SharedDocumentGetPayload<typeof sharedDocumentWithRelations>;

export const userWithDocuments = Prisma.validator<Prisma.UserDefaultArgs>()({
    include: {
        ownedDocuments: {
            include: {
                versions: true,
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
            }
        },
        sharedDocuments: {
            include: {
                document: {
                    include: {
                        owner: true,
                        versions: true
                    }
                }
            }
        },
    },
});

export type UserWithDocuments = Prisma.UserGetPayload<typeof userWithDocuments>;