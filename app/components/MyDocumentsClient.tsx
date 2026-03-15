"use client";

import React, { useActionState, useState, useTransition, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { UserWithDocuments, DocumentWithVersions, DocumentVersionWithRelations } from "../lib/types";
import { uploadNewVersion, shareDocument, getPresignedUrl, unredactAndDownload, deleteDocument } from "../lib/actions";
import { ChevronRight, File, BrainCircuit, Cpu, Users, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

type User = UserWithDocuments;

const UploadForm = ({ onClose }: { onClose: () => void }) => {
    const [state, formAction] = useActionState(uploadNewVersion, { success: false, message: "" });
    useEffect(() => { if (state.success) onClose(); }, [state, onClose]);

    return (
        <form action={formAction}>
            <h2 className="text-xl font-bold mb-4">Upload New Version</h2>
            <div className="space-y-4">
                <div>
                    <label htmlFor="displayName" className="block text-sm font-medium">Document Name (group for versions)</label>
                    <input type="text" name="displayName" required className="mt-1 w-full border p-2 rounded" placeholder="e.g., My Passport" />
                </div>
                <div>
                    <label htmlFor="file" className="block text-sm font-medium">File</label>
                    <input type="file" id="file" name="file" accept=".pdf,.png,.jpg,.jpeg" required className="mt-1 w-full border p-2 rounded" />
                </div>
                <div>
                    <label className="block text-sm font-medium">Redaction Engine</label>
                    <select name="engine" defaultValue="classic" className="mt-1 w-full border p-2 rounded">
                        <option value="classic">Classic (Fast & Local)</option>
                        <option value="llm">LLM (Slower & More Accurate)</option>
                    </select>
                    <input type="hidden" name="engine" value="classic" />
                </div>
            </div>
            <SubmitButton text="Upload" />
            {state && !state.success && state.message && <p className="mt-2 text-red-500">{state.message}</p>}
        </form>
    );
};

const UploadVersionForm = ({ documentId, displayName, onClose }: { documentId: string; displayName: string; onClose: () => void; }) => {
    const [state, formAction] = useActionState(uploadNewVersion, { success: false, message: "" });
    useEffect(() => { if (state.success) onClose(); }, [state, onClose]);

    return (
        <form action={formAction}>
            <h2 className="text-xl font-bold mb-4">Upload New Version for &quot;{displayName}&quot;</h2>
            <input type="hidden" name="documentId" value={documentId} />
            <input type="hidden" name="displayName" value={displayName} />
            
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium">Document Group</label>
                    <p className="mt-1 p-2 bg-gray-100 rounded">{displayName}</p>
                </div>
                <div>
                    <label htmlFor="file" className="block text-sm font-medium">File</label>
                    <input type="file" id="file" name="file" accept=".pdf,.png,.jpg,.jpeg" required className="mt-1 w-full border p-2 rounded" />
                </div>
                <div>
                    <label className="block text-sm font-medium">Redaction Engine</label>
                    <select name="engine" defaultValue="classic" className="mt-1 w-full border p-2 rounded">
                        <option value="classic">Classic (Fast & Local)</option>
                        <option value="llm">LLM (Slower & More Accurate)</option>
                    </select>
                </div>
            </div>
            <SubmitButton text="Upload Version" />
            {state && !state.success && state.message && <p className="mt-2 text-red-500">{state.message}</p>}
        </form>
    );
};
const ShareForm = ({ documentId, onClose }: { documentId: string; onClose: () => void; }) => {
    const [state, formAction] = useActionState(shareDocument, { success: false, message: "" });
    const [access, setAccess] = useState<"REDACTED" | "ORIGINAL">("REDACTED");
    const [protect, setProtect] = useState(false);
    useEffect(() => { if (state.success) onClose(); }, [state, onClose]);

    return (
        <form action={formAction}>
            <h2 className="text-xl font-bold mb-4">Share Document</h2>
            <input type="hidden" name="documentId" value={documentId} />
            <div className="space-y-4">
                <div>
                    <label htmlFor="email" className="block text-sm font-medium">User&apos;s Email</label>
                    <input type="email" id="email" name="email" required className="mt-1 w-full border p-2 rounded" />
                </div>
                <div>
                    <label className="block text-sm font-medium">Access Level</label>
                    <select name="accessLevel" value={access} onChange={(e) => setAccess(e.target.value as "REDACTED" | "ORIGINAL")} className="mt-1 w-full border p-2 rounded">
                        <option value="REDACTED">Redacted Version</option>
                        <option value="ORIGINAL">Original Version</option>
                    </select>
                </div>
                {access === 'ORIGINAL' && (
                    <div className="space-y-2 border-t pt-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={protect} onChange={(e) => setProtect(e.target.checked)} />
                            <span>Password Protect Downloaded File</span>
                        </label>
                        {protect && (
                            <input 
                                type="password" 
                                name="password" 
                                placeholder="Enter password for the PDF" 
                                required 
                                className="mt-2 w-full border p-2 rounded" 
                            />
                        )}
                    </div>
                )}
            </div>
            <SubmitButton text="Share" />
            {state && !state.success && state.message && <p className="mt-2 text-red-500">{state.message}</p>}
        </form>
    );
};
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
const SharedWithPopover = ({ sharedWith }: { sharedWith: DocumentWithVersions['sharedWith'] }) => {
    if (!sharedWith || sharedWith.length === 0) {
        return null;
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button 
                    variant="secondary" 
                    size="sm" 
                    className="flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                >
                    <Users className="w-4 h-4" />
                    <span>{sharedWith.length}</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
                <div className="grid gap-4">
                    <div className="space-y-2">
                        <h4 className="font-medium leading-none">Shared With</h4>
                        <p className="text-sm text-muted-foreground">
                            This document is shared with the following users.
                        </p>
                    </div>
                    <ScrollArea className="max-h-32">
                        <div className="grid gap-2 pr-4">
                            {sharedWith.map((share) => (
                                <div key={share.user.email} className="grid grid-cols-3 items-center gap-4">
                                    <span className="col-span-2 truncate text-sm font-medium" title={share.user.email || 'No email'}>
                                        {share.user.name || share.user.email}
                                    </span>
                                    <span className={`text-right text-xs font-semibold ${
                                        share.accessLevel === 'ORIGINAL' ? 'text-green-600' : 'text-yellow-600'
                                    }`}>
                                        {share.accessLevel}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            </PopoverContent>
        </Popover>
    );
};


interface DocumentTreeProps {
  doc: DocumentWithVersions;
  onShare: (docId: string) => void;
  onView: (s3Key: string) => void;
  onUploadNewVersion: (documentId: string, displayName: string) => void;
  onDelete: (documentId: string, displayName: string) => void;
}

const DocumentTree: React.FC<DocumentTreeProps> = ({ doc, onShare, onView, onUploadNewVersion, onDelete }) => {
    const [isOpen, setOpen] = useState(false);
    const versions = doc.versions || [];

    return (
        <div className="p-4 bg-white rounded-lg border">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setOpen(!isOpen)}>
                <div className="flex items-center gap-2">
                    <ChevronRight className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    <File className="w-5 h-5 text-blue-600" />
                    <span className="font-bold text-lg">{doc.displayName}</span>
                </div>
                <div className="flex items-center gap-2">
                    <SharedWithPopover sharedWith={doc.sharedWith} />
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={(e) => { e.stopPropagation(); onUploadNewVersion(doc.id, doc.displayName); }}
                    >
                        New Version
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={(e) => { e.stopPropagation(); onShare(doc.id); }}
                    >
                        Share
                    </Button>
                    <Button
                        variant="destructive"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); onDelete(doc.id, doc.displayName); }}
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
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
export default function MyDocumentsClient({ user }: { user: User }) {
    const [isUploadModalOpen, setUploadModalOpen] = useState(false);
    const [shareModal, setShareModal] = useState<{ docId: string } | null>(null);
    const [versionUploadModal, setVersionUploadModal] = useState<{ documentId: string; displayName: string } | null>(null);
    const [, startTransition] = useTransition();
    const { toast } = useToast();
    const router = useRouter();

    const handleView = (s3Key: string) => startTransition(async () => {
        const result = await getPresignedUrl(s3Key);
        if (result.url) window.open(result.url, '_blank');
        else alert(result.error || "Could not open document.");
    });
    
    const[, startDeleteTransition] = useTransition();
    const handleDelete = (documentId: string, displayName: string) => {
        if (window.confirm(`Are you sure you want to permanently delete "${displayName}" and all its versions? This action cannot be undone.`)) {
            startDeleteTransition(async () => {
                const result = await deleteDocument(documentId);
                if (result.success) {
                    toast({ title: "Success", description: `"${displayName}" was deleted.` });
                    router.refresh();
                } else {
                    toast({ variant: "destructive", title: "Error", description: result.error });
                }
            });
        }
    };
    
    const ownedDocs = user?.ownedDocuments || [];

    return (
        <div className="container mx-auto p-8 w-full">
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">My Documents</h1>
                <Button onClick={() => setUploadModalOpen(true)}>Upload Document</Button>
            </header>

            <section className="bg-gray-100 p-6 rounded-lg shadow-md mb-8">
                {ownedDocs.length > 0 ? (
                    <div className="space-y-4">
                        {ownedDocs.map((doc) => (
                            <DocumentTree 
                                key={doc.id} 
                                doc={doc} 
                                onShare={() => setShareModal({ docId: doc.id })}
                                onView={handleView}
                                onUploadNewVersion={(documentId, displayName) => setVersionUploadModal({ documentId, displayName })}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-gray-500">You haven&apos;t uploaded any documents yet. Try uploading one!</p>
                )}
            </section>
            
            <Modal isOpen={isUploadModalOpen} onClose={() => setUploadModalOpen(false)}>
                <UploadForm onClose={() => setUploadModalOpen(false)} />
            </Modal>
            
            {shareModal && (
                <Modal isOpen={true} onClose={() => setShareModal(null)}>
                    <ShareForm documentId={shareModal.docId} onClose={() => setShareModal(null)} />
                </Modal>
            )}

            {versionUploadModal && (
                <Modal isOpen={true} onClose={() => setVersionUploadModal(null)}>
                    <UploadVersionForm 
                        documentId={versionUploadModal.documentId}
                        displayName={versionUploadModal.displayName}
                        onClose={() => setVersionUploadModal(null)} 
                    />
                </Modal>
            )}
        </div>
    );
}

const SubmitButton = ({ text }: { text: string }) => {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="mt-4 w-full">
            {pending ? <div className="loader-sm"></div> : text}
        </Button>
    );
};

const Modal = ({ isOpen, onClose, children }: { isOpen: boolean, onClose: () => void, children: React.ReactNode }) => { if (!isOpen) return null; return <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"><div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md relative"><button onClick={onClose} className="absolute top-2 right-2 text-xl font-bold">&times;</button>{children}</div></div>; };