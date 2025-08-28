"use client";

import { useActionState, useState, useTransition, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { uploadDocument, shareDocument, getPresignedUrl } from "../lib/actions";
import { UserWithDocuments } from "../lib/types";

type User = UserWithDocuments;

const DocumentLink = ({
    s3Key,
    fileName,
}: {
    s3Key: string;
    fileName: string;
}) => {
    const [isPending, startTransition] = useTransition();

    const handleOpenDocument = () => {
        startTransition(async () => {
            const result = await getPresignedUrl(s3Key);
            if (result.url) {
                window.open(result.url, "_blank");
            } else {
                alert(result.error || "Could not open document.");
            }
        });
    };

    return (
        <button
            onClick={handleOpenDocument}
            disabled={isPending}
            className="font-bold text-blue-600 hover:underline text-left disabled:text-gray-500 disabled:cursor-not-allowed"
        >
            {isPending ? "Opening..." : fileName}
        </button>
    );
};

const SubmitButton = ({ text }: { text: string }) => {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending}
            className="mt-4 w-full bg-blue-500 text-white p-2 rounded-md disabled:bg-gray-400"
        >
            {pending ? "Submitting..." : text}
        </button>
    );
};

const Modal = ({
    isOpen,
    onClose,
    children,
}: {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
}) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md relative">
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 text-xl font-bold"
                >
                    ×
                </button>
                {children}
            </div>
        </div>
    );
};

// --- Form Components ---

const UploadForm = ({ onClose }: { onClose: () => void }) => {
    const [state, formAction] = useActionState(uploadDocument, { message: "" });

    useEffect(() => {
        if (state.message.includes("successfully")) {
            onClose();
        }
    }, [state, onClose]);

    return (
        <form action={formAction}>
            <h2 className="text-xl font-bold mb-4">Upload a New Document</h2>
            <div>
                <label
                    htmlFor="file"
                    className="block text-sm font-medium text-gray-700"
                >
                    PDF Document
                </label>
                <input
                    type="file"
                    id="file"
                    name="file"
                    accept="application/pdf"
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                />
            </div>
            <SubmitButton text="Upload" />
            {state.message && (
                <p className="mt-2 text-red-500">{state.message}</p>
            )}
        </form>
    );
};

const ShareForm = ({
    documentId,
    onClose,
}: {
    documentId: string;
    onClose: () => void;
}) => {
    const [state, formAction] = useActionState(shareDocument, { message: "" });

    useEffect(() => {
        if (state.message.includes("shared with")) {
            onClose();
        }
    }, [state, onClose]);

    return (
        <form action={formAction}>
            <h2 className="text-xl font-bold mb-4">Share Document</h2>
            <input type="hidden" name="documentId" value={documentId} />
            <div>
                <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700"
                >
                    User&apos;s Email
                </label>
                <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                />
            </div>
            <SubmitButton text="Share" />
            {state.message && (
                <p className="mt-2 text-red-500">{state.message}</p>
            )}
        </form>
    );
};

export default function DashboardClient({ user }: { user: User }) {
    const [isUploadModalOpen, setUploadModalOpen] = useState(false);
    const [isShareModalOpen, setShareModalOpen] = useState(false);
    const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

    const openShareModal = (docId: string) => {
        setSelectedDocId(docId);
        setShareModalOpen(true);
    };

    return (
        <div className="container mx-auto p-8">
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <button
                    onClick={() => setUploadModalOpen(true)}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
                >
                    Upload Document
                </button>
            </header>

            <section className="bg-gray-100 p-6 rounded-lg shadow-md mb-8">
                <h2 className="text-2xl font-semibold mb-4">My Documents</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {user.ownedDocuments.map((doc) => (
                        <div
                            key={doc.id}
                            className="bg-white p-4 rounded-lg border flex flex-col justify-between"
                        >
                            <div>
                                <DocumentLink
                                    s3Key={doc.s3Key}
                                    fileName={doc.fileName}
                                />
                                <p className="text-sm text-gray-500">
                                    Uploaded:{" "}
                                    {new Date(
                                        doc.createdAt
                                    ).toLocaleDateString()}
                                </p>
                            </div>
                            <button
                                onClick={() => openShareModal(doc.id)}
                                className="mt-4 bg-green-500 text-white text-sm py-1 px-3 rounded self-start"
                            >
                                Share
                            </button>
                        </div>
                    ))}
                    {user.ownedDocuments.length === 0 && (
                        <p>You haven&apos;t uploaded any documents yet.</p>
                    )}
                </div>
            </section>

            <section className="bg-blue-50 p-6 rounded-lg shadow-md">
                <h2 className="text-2xl font-semibold mb-4">Shared With Me</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {user.sharedDocuments.map((sharedDoc) => (
                        <div
                            key={sharedDoc.document.id}
                            className="bg-white p-4 rounded-lg border"
                        >
                            <DocumentLink
                                s3Key={sharedDoc.document.s3Key}
                                fileName={sharedDoc.document.fileName}
                            />
                            <p className="text-sm text-gray-500">
                                Shared by:{" "}
                                {sharedDoc.document.owner.name ||
                                    sharedDoc.document.owner.email}
                            </p>
                        </div>
                    ))}
                    {user.sharedDocuments.length === 0 && (
                        <p>No documents have been shared with you.</p>
                    )}
                </div>
            </section>

            <Modal
                isOpen={isUploadModalOpen}
                onClose={() => setUploadModalOpen(false)}
            >
                <UploadForm onClose={() => setUploadModalOpen(false)} />
            </Modal>

            <Modal
                isOpen={isShareModalOpen}
                onClose={() => setShareModalOpen(false)}
            >
                {selectedDocId && (
                    <ShareForm
                        documentId={selectedDocId}
                        onClose={() => setShareModalOpen(false)}
                    />
                )}
            </Modal>
        </div>
    );
}
