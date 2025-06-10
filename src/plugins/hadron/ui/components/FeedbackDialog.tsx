/**
 * Feedback Dialog Component
 * 
 * Modal dialog for collecting user feedback on AI analysis
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../client/components/ui/dialog';
import { Button } from '../../../../client/components/ui/button';
import { Textarea } from '../../../../client/components/ui/textarea';
import { Badge } from '../../../../client/components/ui/badge';
import { Card } from '../../../../client/components/ui/card';
import {    
  Star,
  ThumbsUp,
  ThumbsDown,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MessageSquare,
  Lightbulb,
  Clock,
  BookOpen,
  RefreshCw,
  BarChart3
    } from 'lucide-react';
import { CrashAnalysisResult } from '../../src/interfaces';
import { 
  FeedbackRating,
  AccuracyRating,
  UsefulnessRating 
} from '../../src/services/feedback/feedback-service';

interface FeedbackDialogProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: CrashAnalysisResult;
  crashLogId: string;
  onSubmit: (feedback: {
    rating: FeedbackRating;
    accuracy: AccuracyRating;
    usefulness: UsefulnessRating;
    comments?: string;
    correctRootCause?: string;
    missedIssues?: string[];
    incorrectSuggestions?: string[];
    helpfulSuggestions?: string[];
  }) => Promise<void>;
}

export const FeedbackDialog: React.FC<FeedbackDialogProps> = ({
  isOpen,
  onClose,
  analysis,
  crashLogId,
  onSubmit
}) => {
  const [rating, setRating] = useState<FeedbackRating>(FeedbackRating.Neutral);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<AccuracyRating>({
    rootCauseAccurate: false,
    suggestionsHelpful: false,
    confidenceAppropriate: false,
    nothingMissed: false
  });
  const [usefulness, setUsefulness] = useState<UsefulnessRating>({
    savedTime: false,
    learnedSomething: false,
    wouldUseAgain: false,
    betterThanManual: false
  });
  const [comments, setComments] = useState('');
  const [correctRootCause, setCorrectRootCause] = useState('');
  const [missedIssues, setMissedIssues] = useState('');
  const [incorrectSuggestions, setIncorrectSuggestions] = useState('');
  const [helpfulSuggestions, setHelpfulSuggestions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const ratingLabels = ['Very Poor', 'Poor', 'Neutral', 'Good', 'Excellent'];

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit({
        rating,
        accuracy,
        usefulness,
        comments: comments || undefined,
        correctRootCause: correctRootCause || undefined,
        missedIssues: missedIssues ? missedIssues.split('\n').filter(Boolean) : undefined,
        incorrectSuggestions: incorrectSuggestions ? incorrectSuggestions.split('\n').filter(Boolean) : undefined,
        helpfulSuggestions: helpfulSuggestions ? helpfulSuggestions.split('\n').filter(Boolean) : undefined
      });
      onClose();
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleAccuracy = (key: keyof AccuracyRating) => {
    setAccuracy(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleUsefulness = (key: keyof UsefulnessRating) => {
    setUsefulness(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Analysis Feedback
          </DialogTitle>
          <DialogDescription>
            Help us improve by sharing your experience with this crash analysis
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Overall Rating */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Overall Rating</label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  onClick={() => setRating(value as FeedbackRating)}
                  onMouseEnter={() => setHoveredRating(value)}
                  onMouseLeave={() => setHoveredRating(null)}
                  className="focus:outline-none"
                >
                  <Star
                    className={`h-8 w-8 transition-colors ${
                      value <= (hoveredRating || rating)
                        ? 'text-yellow-500 fill-yellow-500'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
              <span className="ml-2 text-sm text-muted-foreground">
                {ratingLabels[(hoveredRating || rating) - 1]}
              </span>
            </div>
          </div>

          {/* Accuracy Assessment */}
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Accuracy Assessment
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Card
                className={`p-3 cursor-pointer transition-colors ${
                  accuracy.rootCauseAccurate ? 'bg-green-50 border-green-500' : ''
                }`}
                onClick={() => toggleAccuracy('rootCauseAccurate')}
              >
                <div className="flex items-center gap-2">
                  {accuracy.rootCauseAccurate ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-gray-400" />
                  )}
                  <span className="text-sm">Root cause was accurate</span>
                </div>
              </Card>

              <Card
                className={`p-3 cursor-pointer transition-colors ${
                  accuracy.suggestionsHelpful ? 'bg-green-50 border-green-500' : ''
                }`}
                onClick={() => toggleAccuracy('suggestionsHelpful')}
              >
                <div className="flex items-center gap-2">
                  {accuracy.suggestionsHelpful ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-gray-400" />
                  )}
                  <span className="text-sm">Suggestions were helpful</span>
                </div>
              </Card>

              <Card
                className={`p-3 cursor-pointer transition-colors ${
                  accuracy.confidenceAppropriate ? 'bg-green-50 border-green-500' : ''
                }`}
                onClick={() => toggleAccuracy('confidenceAppropriate')}
              >
                <div className="flex items-center gap-2">
                  {accuracy.confidenceAppropriate ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-gray-400" />
                  )}
                  <span className="text-sm">Confidence level was appropriate</span>
                </div>
              </Card>

              <Card
                className={`p-3 cursor-pointer transition-colors ${
                  accuracy.nothingMissed ? 'bg-green-50 border-green-500' : ''
                }`}
                onClick={() => toggleAccuracy('nothingMissed')}
              >
                <div className="flex items-center gap-2">
                  {accuracy.nothingMissed ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-gray-400" />
                  )}
                  <span className="text-sm">Nothing important was missed</span>
                </div>
              </Card>
            </div>
          </div>

          {/* Usefulness Assessment */}
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Usefulness Assessment
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Card
                className={`p-3 cursor-pointer transition-colors ${
                  usefulness.savedTime ? 'bg-blue-50 border-blue-500' : ''
                }`}
                onClick={() => toggleUsefulness('savedTime')}
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">Saved me time</span>
                </div>
              </Card>

              <Card
                className={`p-3 cursor-pointer transition-colors ${
                  usefulness.learnedSomething ? 'bg-blue-50 border-blue-500' : ''
                }`}
                onClick={() => toggleUsefulness('learnedSomething')}
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">I learned something new</span>
                </div>
              </Card>

              <Card
                className={`p-3 cursor-pointer transition-colors ${
                  usefulness.wouldUseAgain ? 'bg-blue-50 border-blue-500' : ''
                }`}
                onClick={() => toggleUsefulness('wouldUseAgain')}
              >
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">Would use again</span>
                </div>
              </Card>

              <Card
                className={`p-3 cursor-pointer transition-colors ${
                  usefulness.betterThanManual ? 'bg-blue-50 border-blue-500' : ''
                }`}
                onClick={() => toggleUsefulness('betterThanManual')}
              >
                <div className="flex items-center gap-2">
                  <ThumbsUp className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">Better than manual analysis</span>
                </div>
              </Card>
            </div>
          </div>

          {/* Toggle for detailed feedback */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className="w-full"
          >
            {showDetails ? 'Hide' : 'Show'} Detailed Feedback
          </Button>

          {/* Detailed Feedback (conditional) */}
          {showDetails && (
            <div className="space-y-4 border-t pt-4">
              {!accuracy.rootCauseAccurate && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    What was the correct root cause?
                  </label>
                  <Textarea
                    placeholder="Describe the actual root cause of the issue..."
                    value={correctRootCause}
                    onChange={(e) => setCorrectRootCause(e.target.value)}
                    rows={2}
                  />
                </div>
              )}

              {!accuracy.nothingMissed && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    What issues were missed? (one per line)
                  </label>
                  <Textarea
                    placeholder="List any important issues that were not identified..."
                    value={missedIssues}
                    onChange={(e) => setMissedIssues(e.target.value)}
                    rows={3}
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Which suggestions were incorrect? (one per line)
                </label>
                <Textarea
                  placeholder="List any suggestions that were wrong or misleading..."
                  value={incorrectSuggestions}
                  onChange={(e) => setIncorrectSuggestions(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Which suggestions were particularly helpful? (one per line)
                </label>
                <Textarea
                  placeholder="List the most valuable suggestions..."
                  value={helpfulSuggestions}
                  onChange={(e) => setHelpfulSuggestions(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* General Comments */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Additional Comments (optional)
            </label>
            <Textarea
              placeholder="Any other feedback or suggestions for improvement..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={4}
            />
          </div>

          {/* Analysis Summary */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Analysis Summary
            </h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Model: {analysis.llmModel}</p>
              <p>Confidence: {(analysis.confidence * 100).toFixed(0)}%</p>
              <p>Root Causes Identified: {analysis.potentialRootCauses.length}</p>
              <p>Suggestions Provided: {analysis.troubleshootingSteps.length}</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};