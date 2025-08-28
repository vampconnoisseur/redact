import { Prisma } from "@prisma/client";

const userWithDocuments = Prisma.validator<Prisma.UserDefaultArgs>()({
    include: {
        ownedDocuments: true,
        sharedDocuments: {
            include: {
                document: {
                    include: {
                        owner: true,
                    },
                },
            },
        },
    },
});

export type UserWithDocuments = Prisma.UserGetPayload<typeof userWithDocuments>;
