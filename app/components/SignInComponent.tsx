import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "next-auth/react";
import { useToast } from "@/hooks/use-toast";

export function SignInComponent() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const sendEmail = async () => {
        setLoading(true);
        try {
            await signIn("email", { email });
            setTimeout(() => {
                toast({
                    title: "Email sent.",
                    description:
                        "Check your mailbox and click the verification link.",
                });
                setLoading(false);
            }, 1500);
        } catch (error) {
            if (error instanceof Error) {
                setLoading(false);
                toast({
                    title: "Error",
                    description: error.message,
                });
            }
        }
    };

    return (
        <div className="flex flex-col justify-center items-center space-y-6">
            <Card className="w-[350px]">
                <CardHeader>
                    <CardTitle>Sign In</CardTitle>
                    <CardDescription>
                        Enter your email for a verification link
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form>
                        <div className="grid w-full items-center gap-4">
                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    placeholder="Enter your email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>
                    </form>
                </CardContent>
                <CardFooter className="flex justify-center">
                    {loading ? (
                        <div className="loader"></div>
                    ) : (
                        <Button onClick={sendEmail} className="w-full">
                            Send Link
                        </Button>
                    )}
                </CardFooter>
            </Card>

            <div className="text-gray-500 font-medium">or</div>

            <Button
                className="py-2 px-6 rounded-md"
                onClick={() => signIn("google")}
            >
                Sign in with Google
            </Button>
        </div>
    );
}
