import { Prisma } from "@prisma/client";

// By adding this comment, you are telling the linter that you intentionally
// are not using this variable as a value, and it should not trigger a warning.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
