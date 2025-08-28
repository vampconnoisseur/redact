import type { Metadata } from "next";
import "./globals.css";
import SessionWrapper from "./components/SessionWrapper";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { PlayfairDisplayHeading } from "@/lib/fonts";
import { AppSidebar } from "./components/app-sidebar";
import { Toaster } from "@/components/ui/toaster";
import { getServerSession } from "next-auth";
import { authOptions } from "./lib/auth";
import { fetchUserWithDocuments } from "./lib/data";
import { UserWithDocuments } from "./lib/types";

export const metadata: Metadata = {
    title: "redact",
    description: "Event management app",
};

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getServerSession(authOptions);

    let user: UserWithDocuments | null = null;
    if (session?.user?.email) {
        user = await fetchUserWithDocuments(session.user.email);
    }

    return (
        <html>
            <body>
                <SessionWrapper>
                    <SidebarProvider>
                        <AppSidebar user={user} />
                        <main className="w-full">
                            <div className="sticky top-0 z-10 flex items-center px-4 py-2 backdrop-blur-md backdrop-brightness-125 border border-gray-300/50 shadow-sm">
                                <SidebarTrigger className="" />
                                <h1
                                    className={`flex-1 text-center text-4xl pr-16 ${PlayfairDisplayHeading.className}`}
                                >
                                    redact
                                </h1>
                            </div>
                            <div className="flex flex-col min-h-screen justify-center items-center">
                                {children}
                            </div>
                        </main>
                    </SidebarProvider>
                </SessionWrapper>
                <Toaster />
            </body>
        </html>
    );
}
