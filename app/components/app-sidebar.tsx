"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronUp, User, LayoutDashboard, LogOut, LogIn } from "lucide-react";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@radix-ui/react-dropdown-menu";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { UserWithDocuments } from "../lib/types";

export function AppSidebar({ user }: { user: UserWithDocuments | null }) {
    const currentPath = usePathname();

    const isAdmin = user?.isAdmin ?? false;
    const userName = user?.name ?? "Guest";
    const isAuthenticated = !!user;

    const items = useMemo(() => {
        const menuItems = [
            { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
        ];

        if (isAdmin) {
            menuItems.push({
                title: "Admin Panel",
                url: "/admin",
                icon: User,
            });
        }

        return menuItems;
    }, [isAdmin]);

    return (
        <Sidebar>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel className="pr-8">
                        My Documents
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {items.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton
                                        isActive={currentPath === item.url}
                                        asChild
                                    >
                                        <Link href={item.url}>
                                            <item.icon className="h-5 w-5" />
                                            <span>{item.title}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <SidebarMenuButton className="font-medium">
                                    <User className="h-5 w-5" />
                                    <span>{userName}</span>
                                    <ChevronUp className="ml-auto h-4 w-4" />
                                </SidebarMenuButton>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                side="top"
                                className="w-[--radix-popper-anchor-width] mb-2 p-1 rounded-md bg-gray-200 dark:bg-gray-800"
                            >
                                {isAuthenticated ? (
                                    <DropdownMenuItem asChild>
                                        <button
                                            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-700 rounded-sm"
                                            onClick={() => signOut()}
                                        >
                                            <LogOut className="h-4 w-4" />
                                            Sign Out
                                        </button>
                                    </DropdownMenuItem>
                                ) : (
                                    <DropdownMenuItem asChild>
                                        <Link
                                            href="/api/auth/signin"
                                            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-700 rounded-sm"
                                        >
                                            <LogIn className="h-4 w-4" />
                                            Sign In
                                        </Link>
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    );
}
