import { getServerSession } from "next-auth";
import { authOptions } from "../lib/auth";
import { redirect } from "next/navigation";
import { fetchUserWithDocuments } from "../lib/data";
import DashboardClient from "@/app/components/DashboardClient";

export default async function DashboardPage() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return redirect("/");
    }

    const user = await fetchUserWithDocuments(session.user.email);

    if (!user) {
        return redirect("/");
    }

    return <DashboardClient user={user} />;
}
