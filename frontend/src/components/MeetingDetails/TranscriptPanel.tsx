"use client";

import { Transcript, TranscriptSegmentData } from '@/types';
import { TranscriptView } from '@/components/TranscriptView';
import { VirtualizedTranscriptView } from '@/components/VirtualizedTranscriptView';
import { TranscriptButtonGroup } from './TranscriptButtonGroup';
import { AudioPlayer } from '@/components/AudioPlayer';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Mirrors the `MeetingAudio` payload returned by the `get_meeting_audio_path` command.
 * Unit variants serialise as plain strings; `UnsupportedFormat` carries the extension, so
 * serde emits it as an externally tagged object.
 */
type AudioUnavailableReason =
  | 'meeting_not_found'
  | 'no_folder_recorded'
  | 'folder_missing'
  | 'no_audio_in_folder'
  | { unsupported_format: string };

interface MeetingAudio {
  path: string | null;
  unavailableReason: AudioUnavailableReason | null;
}

function describeUnavailableAudio(reason: AudioUnavailableReason | null): string {
  if (reason && typeof reason === 'object' && 'unsupported_format' in reason) {
    return `This recording is a .${reason.unsupported_format} file, which cannot be played in the app.`;
  }

  switch (reason) {
    case 'no_folder_recorded':
      return 'This meeting has no recording folder.';
    case 'folder_missing':
      return 'The recording folder for this meeting no longer exists.';
    case 'no_audio_in_folder':
      return 'No audio file was found in this meeting\'s recording folder.';
    default:
      return 'No recording audio is available for this meeting.';
  }
}

/**
 * Finds the segment covering `time`, assuming segments are ordered by timestamp ascending.
 * Returns null while playback sits in a gap after a segment with a known end time.
 *
 * Callers pass only segments that carry an offset; segments without one cannot be located in
 * the recording and must not be treated as sitting at zero.
 */
function findSegmentIdAt(locatable: TranscriptSegmentData[], time: number): string | null {
  let low = 0;
  let high = locatable.length - 1;
  let candidate = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (locatable[mid].timestamp! <= time) {
      candidate = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (candidate === -1) return null;

  const segment = locatable[candidate];
  if (segment.endTime !== undefined && time > segment.endTime) return null;

  return segment.id;
}

interface TranscriptPanelProps {
  transcripts: Transcript[];
  customPrompt: string;
  onPromptChange: (value: string) => void;
  onCopyTranscript: () => void;
  onOpenMeetingFolder: () => Promise<void>;
  isRecording: boolean;
  disableAutoScroll?: boolean;

  // Optional pagination props (when using virtualization)
  usePagination?: boolean;
  segments?: TranscriptSegmentData[];
  hasMore?: boolean;
  isLoadingMore?: boolean;
  totalCount?: number;
  loadedCount?: number;
  onLoadMore?: () => void;

  // Retranscription props
  meetingId?: string;
  meetingFolderPath?: string | null;
  onRefetchTranscripts?: () => Promise<void>;
}

export function TranscriptPanel({
  transcripts,
  customPrompt,
  onPromptChange,
  onCopyTranscript,
  onOpenMeetingFolder,
  isRecording,
  disableAutoScroll = false,
  usePagination = false,
  segments,
  hasMore,
  isLoadingMore,
  totalCount,
  loadedCount,
  onLoadMore,
  meetingId,
  meetingFolderPath,
  onRefetchTranscripts,
}: TranscriptPanelProps) {
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [unavailableReason, setUnavailableReason] = useState<AudioUnavailableReason | null>(null);
  const [isResolvingAudio, setIsResolvingAudio] = useState(false);
  // Opt-in: the transcript panel disables auto-scroll by default, so following is off
  // until the user asks for it from the player.
  const [isFollowing, setIsFollowing] = useState(false);

  // The player lives here rather than inside AudioPlayer so playback survives collapsing
  // the player bar, and so the transcript can follow along with the current time.
  const player = useAudioPlayer(audioPath);
  const isAudioAvailable = audioPath !== null;

  // Fetch audio file path when meeting changes
  useEffect(() => {
    let isCancelled = false;

    // Drop the previous meeting's recording before awaiting the next path, so it cannot keep
    // playing, and so this transcript's timestamps cannot seek the wrong audio.
    setAudioPath(null);
    setUnavailableReason(null);

    const checkAudioPath = async () => {
      if (!meetingId || meetingId === 'intro-call') {
        return;
      }

      setIsResolvingAudio(true);
      try {
        const audio = await invoke<MeetingAudio>('get_meeting_audio_path', { meetingId });

        if (!isCancelled) {
          setAudioPath(audio.path ?? null);
          setUnavailableReason(audio.path ? null : audio.unavailableReason ?? null);
        }
      } catch (err) {
        console.warn('Could not resolve meeting audio path:', err);
      } finally {
        if (!isCancelled) {
          setIsResolvingAudio(false);
        }
      }
    };

    checkAudioPath();

    return () => {
      isCancelled = true;
    };
  }, [meetingId, meetingFolderPath]);

  // Collapse the player once resolution has settled on a meeting with no recording. Waiting for
  // it to settle keeps the player open across a switch between two meetings that both have audio.
  useEffect(() => {
    if (!isResolvingAudio && !audioPath) {
      setIsPlayerOpen(false);
    }
  }, [isResolvingAudio, audioPath]);

  // Convert transcripts to segments if pagination is not used but we want virtualization
  const convertedSegments = useMemo(() => {
    if (usePagination && segments) {
      return segments;
    }
    // Convert transcripts to segments for virtualization
    return transcripts.map(t => ({
      id: t.id,
      timestamp: t.audio_start_time,
      endTime: t.audio_end_time,
      text: t.text,
      confidence: t.confidence,
    }));
  }, [transcripts, usePagination, segments]);

  // Filtered once per segment change rather than on every playback tick
  const locatableSegments = useMemo(
    () => convertedSegments.filter((s) => s.timestamp !== undefined),
    [convertedSegments]
  );

  // The segment currently being played, used to highlight and follow along
  const activeSegmentId = useMemo(() => {
    if (!isAudioAvailable || locatableSegments.length === 0) return null;
    return findSegmentIdAt(locatableSegments, player.currentTime);
  }, [isAudioAvailable, locatableSegments, player.currentTime]);

  const handleTogglePlayer = useCallback(() => {
    // Resolution is in flight, so we do not yet know whether this meeting has audio
    if (isResolvingAudio) return;

    if (!isAudioAvailable) {
      toast.info(`${describeUnavailableAudio(unavailableReason)} Opening folder...`);
      onOpenMeetingFolder();
      return;
    }
    setIsPlayerOpen((prev) => !prev);
  }, [isResolvingAudio, isAudioAvailable, unavailableReason, onOpenMeetingFolder]);

  const handleTimestampClick = useCallback(
    (timestamp: number) => {
      if (isResolvingAudio) return;

      if (!isAudioAvailable) {
        toast.info(describeUnavailableAudio(unavailableReason));
        return;
      }
      setIsPlayerOpen(true);
      player.seek(timestamp);
      player.play();
    },
    [isResolvingAudio, isAudioAvailable, unavailableReason, player.seek, player.play]
  );

  return (
    <div className="hidden md:flex md:w-1/4 lg:w-1/3 min-w-0 border-r border-gray-200 bg-white flex-col relative shrink-0">
      {/* Title area */}
      <div className="p-4 border-b border-gray-200">
        <TranscriptButtonGroup
          transcriptCount={usePagination ? (totalCount ?? convertedSegments.length) : (transcripts?.length || 0)}
          onCopyTranscript={onCopyTranscript}
          onOpenMeetingFolder={onOpenMeetingFolder}
          meetingId={meetingId}
          meetingFolderPath={meetingFolderPath}
          onRefetchTranscripts={onRefetchTranscripts}
          isPlayerOpen={isPlayerOpen}
          onTogglePlayer={handleTogglePlayer}
          hasAudio={isAudioAvailable}
          isPlaying={player.isPlaying}
        />
      </div>

      {/* Audio Player Bar */}
      <AnimatePresence>
        {isPlayerOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-b border-gray-200 bg-gray-50/80 p-3"
          >
            <AudioPlayer
              player={player}
              hasAudio={isAudioAvailable}
              isFollowing={isFollowing}
              onToggleFollow={() => setIsFollowing((prev) => !prev)}
              onOpenFolder={onOpenMeetingFolder}
              onClose={() => setIsPlayerOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transcript content - use virtualized view for better performance */}
      <div className="flex-1 overflow-hidden pb-4">
        <VirtualizedTranscriptView
          segments={convertedSegments}
          isRecording={isRecording}
          isPaused={false}
          isProcessing={false}
          isStopping={false}
          enableStreaming={false}
          showConfidence={true}
          disableAutoScroll={disableAutoScroll}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          totalCount={totalCount}
          loadedCount={loadedCount}
          onLoadMore={onLoadMore}
          onTimestampClick={handleTimestampClick}
          activeSegmentId={activeSegmentId}
          followActiveSegment={isFollowing}
        />
      </div>

      {/* Custom prompt input at bottom of transcript section */}
      {!isRecording && convertedSegments.length > 0 && (
        <div className="p-1 border-t border-gray-200">
          <textarea
            placeholder="Add context for AI summary. For example people involved, meeting overview, objective etc..."
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm min-h-[80px] resize-y"
            value={customPrompt}
            onChange={(e) => onPromptChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

