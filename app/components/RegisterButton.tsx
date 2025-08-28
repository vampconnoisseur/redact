"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { registerUserForEvent } from "../lib/actions";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export default function EventRegistrationSelect({
    eventId,
    userEmail,
    currentRole,
}: {
    eventId: string;
    userEmail: string;
    currentRole?: "ATTENDEE" | "VOLUNTEER";
}) {
    const [role, setRole] = useState<"ATTENDEE" | "VOLUNTEER" | "">(
        currentRole || ""
    );
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (currentRole) {
            setRole(currentRole);
        }
    }, [currentRole]);

    const handleRegister = async () => {
        if (!role) return;
        setLoading(true);
        try {
            await registerUserForEvent(eventId, userEmail, role);
            toast({
                title: "Success",
                description: `Registered as ${role.toLowerCase()}.`,
            });
        } catch (err) {
            toast({
                title: "Error",
                description:
                    err instanceof Error
                        ? err.message
                        : "Something went wrong.",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="m-4 flex gap-2">
            <Select
                value={role}
                onValueChange={(value) =>
                    setRole(value as "ATTENDEE" | "VOLUNTEER")
                }
            >
                <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Register as" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="ATTENDEE">Attendee</SelectItem>
                    <SelectItem value="VOLUNTEER">Volunteer</SelectItem>
                </SelectContent>
            </Select>
            <Button disabled={!role || loading} onClick={handleRegister}>
                {loading ? "Registering..." : currentRole ? "Update" : "Submit"}
            </Button>
        </div>
    );
}
