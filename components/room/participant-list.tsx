"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ParticipantListProps {
  participants: any[];
  hostId: string;
}

export default function ParticipantList({ participants, hostId }: ParticipantListProps) {
  // Get initials from name
  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Participants ({participants.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {participants.map((participant) => (
            <div 
              key={participant.user_id} 
              className="flex items-center gap-3"
            >
              <Avatar>
                <AvatarImage 
                  src={participant.users?.image || ""} 
                  alt={participant.users?.name || "User"} 
                />
                <AvatarFallback>
                  {getInitials(participant.users?.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">
                  {participant.users?.name}
                  {participant.user_id === hostId && (
                    <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      Host
                    </span>
                  )}
                </p>
              </div>
            </div>
          ))}
          
          {participants.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No participants yet
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 