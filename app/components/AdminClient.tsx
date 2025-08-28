"use client";

import { useState } from "react";
import { sendBroadcastEmails } from "../lib/actions";
import DonutChart from "@/components/ui/DonutChart";
import { useToast } from "@/hooks/use-toast";

type RoleType = "ATTENDEE" | "VOLUNTEER";

export default function AdminEventsClient({ events }: { events: AppEvent[] }) {
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [loadingRole, setLoadingRole] = useState<RoleType | null>(null);
    const { toast } = useToast();

    const handleSendEmails = async (eventId: string, role: RoleType) => {
        setLoadingId(eventId);
        setLoadingRole(role);
        try {
            await sendBroadcastEmails(eventId, role);
            toast({
                title: "Emails sent!",
                description: `All ${role.toLowerCase()}s for "${
                    events.find((e) => e.id === eventId)?.name
                }" have been emailed.`,
            });
        } catch (error) {
            toast({
                title: "Failed to send emails",
                description:
                    (error as Error).message ?? "Something went wrong.",
                variant: "destructive",
            });
        } finally {
            setLoadingId(null);
            setLoadingRole(null);
        }
    };

    return (
        <div className="p-8">
            <h1 className="text-4xl font-bold mb-12">Admin Events Dashboard</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {events.map((event) => {
                    const attendees = event.registrations.filter(
                        (r) => r.role === "ATTENDEE"
                    ).length;
                    const volunteers = event.registrations.filter(
                        (r) => r.role === "VOLUNTEER"
                    ).length;

                    const isLoadingAttendee =
                        loadingId === event.id && loadingRole === "ATTENDEE";
                    const isLoadingVolunteer =
                        loadingId === event.id && loadingRole === "VOLUNTEER";

                    return (
                        <div
                            key={event.id}
                            className="p-4 border rounded-xl shadow-md bg-white"
                        >
                            <h2 className="text-lg font-semibold">
                                {event.name}
                            </h2>
                            <p className="text-sm text-gray-600">
                                {new Date(event.time).toLocaleString()}
                            </p>
                            <p className="mt-2 text-sm">
                                Attendees: <strong>{attendees}</strong>
                            </p>
                            <p className="text-sm">
                                Volunteers: <strong>{volunteers}</strong>
                            </p>
                            <div>
                                <DonutChart
                                    attendees={attendees}
                                    volunteers={volunteers}
                                />
                            </div>

                            <div className="mt-8 flex justify-between">
                                {!isLoadingAttendee ? (
                                    <button
                                        className="mt-4 mr-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                                        disabled={isLoadingAttendee}
                                        onClick={() =>
                                            handleSendEmails(
                                                event.id,
                                                "ATTENDEE"
                                            )
                                        }
                                    >
                                        Email Attendees
                                    </button>
                                ) : (
                                    <div className="loader ml-4 mt-4"></div>
                                )}

                                {!isLoadingVolunteer ? (
                                    <button
                                        className="mt-4 mr-2 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                                        disabled={isLoadingVolunteer}
                                        onClick={() =>
                                            handleSendEmails(
                                                event.id,
                                                "VOLUNTEER"
                                            )
                                        }
                                    >
                                        Email Volunteers
                                    </button>
                                ) : (
                                    <div className="loader mr-4 mt-4"></div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
