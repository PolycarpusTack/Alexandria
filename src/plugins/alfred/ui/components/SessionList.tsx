/**
 * Session List Component - Displays and manages chat sessions
 */

import React, { useState } from 'react';
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle 
} from '../../../../client/components/ui/card';
import { Button } from '../../../../client/components/ui/button';
import { Input } from '../../../../client/components/ui/input';
import { Badge } from '../../../../client/components/ui/badge';
import { ScrollArea } from '../../../../client/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../client/components/ui/alert-dialog';
import { useToast } from '../../../../client/components/ui/use-toast';
import { 
  Search, 
  MessageSquare, 
  Trash2, 
  Clock,
  FileText
} from 'lucide-react';
import { ChatSession } from '../../src/interfaces';
import { useAlfredService } from '../hooks/useAlfredService';
import { format, formatDistanceToNow } from 'date-fns';

interface SessionListProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onSessionsChange: () => void;
}

export const SessionList: React.FC<SessionListProps> = ({
  sessions,
  currentSessionId,
  onSessionSelect,
  onSessionsChange
}) => {
  const alfredService = useAlfredService();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);

  const filteredSessions = sessions.filter(session =>
    session.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.messages.some(msg => 
      msg.content.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const handleDeleteSession = async () => {
    if (!deleteSessionId) return;

    try {
      await alfredService.deleteSession(deleteSessionId);
      toast({
        title: 'Session deleted',
        description: 'The chat session has been deleted'
      });
      onSessionsChange();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete session',
        variant: 'destructive'
      });
    } finally {
      setDeleteSessionId(null);
    }
  };

  const getSessionSummary = (session: ChatSession): string => {
    const userMessages = session.messages.filter(m => m.role === 'user');
    if (userMessages.length === 0) return 'No messages';
    
    const firstMessage = userMessages[0].content;
    return firstMessage.length > 100 
      ? firstMessage.substring(0, 100) + '...' 
      : firstMessage;
  };

  return (
    <>
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Sessions */}
        <ScrollArea className="h-[calc(100vh-300px)]">
          <div className="space-y-2">
            {filteredSessions.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    {searchQuery ? 'No sessions found' : 'No chat sessions yet'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredSessions.map((session) => (
                <Card
                  key={session.id}
                  className={`cursor-pointer transition-colors hover:bg-accent ${
                    session.id === currentSessionId ? 'border-primary' : ''
                  }`}
                  onClick={() => onSessionSelect(session.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base line-clamp-1">
                          {session.name}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          <span className="flex items-center gap-2 text-xs">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(session.updatedAt), { 
                              addSuffix: true 
                            })}
                          </span>
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteSessionId(session.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {getSessionSummary(session)}
                    </p>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          <MessageSquare className="h-3 w-3 mr-1" />
                          {session.messages.length}
                        </Badge>
                        {session.projectId && (
                          <Badge variant="outline" className="text-xs">
                            <FileText className="h-3 w-3 mr-1" />
                            Project
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {session.metadata.model}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteSessionId} onOpenChange={() => setDeleteSessionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this chat session? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSession}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};