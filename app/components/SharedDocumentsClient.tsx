"use client";

import React, { useState, useTransition } from "react";
import { unredactAndDownload, getPresignedUrl, removeSharedDocument } from "../lib/actions";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { UserWithDocuments, DocumentVersionWithRelations, SharedDocumentWithRelations } from "../lib/types";
import { ChevronRight, File, BrainCircuit, Cpu } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type User = UserWithDocuments;

interface DocumentVersionNodeProps {
  documentId: string;
  version: DocumentVersionWithRelations;
  onView: (s3Key: string) => void;
}

const DocumentVersionNode: React.FC<DocumentVersionNodeProps> = ({ documentId, version, onView }) => {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleDownload = () => {
        startTransition(async () => {
            const result = await unredactAndDownload(documentId, version.id); 

            if (result.success && result.fileData) {
                const byteCharacters = atob(result.fileData);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: result.contentType });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = result.fileName || 'restored-document.pdf';
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            } else {
                toast({
                    variant: "destructive",
                    title: "Download Failed",
                    description: result.error || "An unknown error occurred.",
                });
            }
        });
    };

    return (
        <div className="ml-8 pl-4 border-l-2 relative py-2 group">
            <div className="flex items-center gap-2">
                {version.engineUsed === "LLM" ? <BrainCircuit className="w-4 h-4 text-purple-500" /> : <Cpu className="w-4 h-4 text-green-500" />}
                <span className="font-medium">Version {version.versionNumber}</span>
                <span className="text-xs text-gray-400">({new Date(version.createdAt).toLocaleString()})</span>
            </div>
            <div className="mt-2 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onView(version.s3Key)}>View Redacted</Button>
                <Button variant="secondary" size="sm" onClick={handleDownload} disabled={isPending}>
                    {isPending ? <div className="loader-sm"></div> : "Download Original"}
                </Button>
            </div>
        </div>
    );
};


interface SharedDocumentTreeProps {
  doc: SharedDocumentWithRelations['document'];
  ownerName: string;
  onView: (s3Key: string) => void;
  onRemove: (documentId: string, displayName: string) => void;
}

const SharedDocumentTree: React.FC<SharedDocumentTreeProps> = ({ doc, ownerName, onView, onRemove }) => {
    const [isOpen, setOpen] = useState(false);
    const versions = doc.versions || [];

    return (
        <div className="p-4 bg-white rounded-lg border">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setOpen(!isOpen)}>
                <div className="flex items-center gap-2">
                    <ChevronRight className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    <File className="w-5 h-5 text-blue-600" />
                    <div>
                        <span className="font-bold text-lg">{doc.displayName}</span>
                        <p className="text-xs text-gray-500">Owner: {ownerName}</p>
                    </div>
                </div>
                <Button
                    variant="destructive"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); onRemove(doc.id, doc.displayName); }}
                >
                    Remove
                </Button>
            </div>
            {isOpen && (
                <div className="mt-2">
                    {versions
                        .sort((a, b) => b.versionNumber - a.versionNumber)
                        .map(v => (
                            <DocumentVersionNode 
                                key={v.id} 
                                documentId={doc.id}
                                version={v} 
                                onView={onView} 
                            />
                        ))}
                </div>
            )}
        </div>
    );
};

export default function SharedDocumentsClient({ user }: { user: User }) {
    const [, startTransition] = useTransition();
    const { toast } = useToast();
    const sharedDocs = user?.sharedDocuments || [];
    const router = useRouter();

    const handleView = (s3Key: string) => startTransition(async () => {
        const result = await getPresignedUrl(s3Key);
        if (result.url) window.open(result.url, '_blank');
        else alert(result.error || "Could not open document.");
    });

    const [, startRemoveTransition] = useTransition();
    const handleRemove = (documentId: string, displayName: string) => {
        if (window.confirm(`Are you sure you want to remove "${displayName}" from your shared list?`)) {
            startRemoveTransition(async () => {
                const result = await removeSharedDocument(documentId);
                if (result.success) {
                    toast({ title: "Success", description: `"${displayName}" was removed from your list.` });
                    router.refresh();
                } else {
                    toast({ variant: "destructive", title: "Error", description: result.error });
                }
            });
        }
    };

    return (
        <div className="container mx-auto p-8 w-full">
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">Shared With Me</h1>
            </header>

            <section className="bg-blue-50 p-6 rounded-lg shadow-md w-full">
                {sharedDocs.length > 0 ? (
                    <div className="space-y-4">
                        {sharedDocs.map((sharedDoc) => {
                            if (!sharedDoc?.document) return null;

                            return (
                                <SharedDocumentTree 
                                    key={sharedDoc.document.id}
                                    doc={sharedDoc.document}
                                    ownerName={sharedDoc.document.owner?.name || 'Unknown'}
                                    onView={handleView}
                                    onRemove={handleRemove}
                                />
                            );
                        })
                    }
                    </div>
                ) : (
                    <p className="text-center text-gray-500">No documents have been shared with you.</p>
                )}
            </section>
        </div>
    );
}