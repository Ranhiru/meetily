import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TranscriptPanel } from '@/components/MeetingDetails/TranscriptPanel';

const mocks = vi.hoisted(() => ({
  currentTime: 700,
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mocks.invoke,
}));

vi.mock('@/hooks/useAudioPlayer', () => ({
  useAudioPlayer: () => ({
    currentTime: mocks.currentTime,
    duration: 1_000,
    isPlaying: true,
    isLoading: false,
    bufferedPercent: 50,
    error: null,
    playbackRate: 1,
    volume: 1,
    isMuted: false,
    play: vi.fn(),
    pause: vi.fn(),
    togglePlay: vi.fn(),
    seek: vi.fn(),
    skip: vi.fn(),
    setPlaybackRate: vi.fn(),
    setVolume: vi.fn(),
    toggleMute: vi.fn(),
  }),
}));

vi.mock('@/components/AudioPlayer', () => ({
  AudioPlayer: ({ onToggleFollow }: { onToggleFollow: () => void }) => (
    <button onClick={onToggleFollow}>Follow transcript</button>
  ),
}));

vi.mock('@/components/MeetingDetails/TranscriptButtonGroup', () => ({
  TranscriptButtonGroup: ({ onTogglePlayer }: { onTogglePlayer: () => void }) => (
    <button onClick={onTogglePlayer}>Open player</button>
  ),
}));

vi.mock('@/components/VirtualizedTranscriptView', () => ({
  VirtualizedTranscriptView: () => <div>Transcript</div>,
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: { div: ({ children }: { children: React.ReactNode }) => <div>{children}</div> },
}));

vi.mock('sonner', () => ({ toast: { info: vi.fn() } }));

function makeSegments(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `segment-${index}`,
    timestamp: index * 6,
    endTime: index * 6 + 5,
    text: `Segment ${index}`,
    confidence: 1,
  }));
}

function panel(overrides: Partial<React.ComponentProps<typeof TranscriptPanel>> = {}) {
  return (
    <TranscriptPanel
      transcripts={[]}
      customPrompt=""
      onPromptChange={vi.fn()}
      onCopyTranscript={vi.fn()}
      onOpenMeetingFolder={vi.fn().mockResolvedValue(undefined)}
      isRecording={false}
      usePagination
      segments={makeSegments(100)}
      hasMore
      isLoadingMore={false}
      totalCount={1_163}
      loadedCount={100}
      onLoadMore={vi.fn().mockResolvedValue(undefined)}
      meetingId="meeting-1"
      meetingFolderPath="/recordings/meeting-1"
      {...overrides}
    />
  );
}

async function enableFollowing() {
  await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith('get_meeting_audio_path', {
    meetingId: 'meeting-1',
  }));
  fireEvent.click(screen.getByRole('button', { name: 'Open player' }));
  fireEvent.click(screen.getByRole('button', { name: 'Follow transcript' }));
}

describe('TranscriptPanel playback following', () => {
  beforeEach(() => {
    mocks.currentTime = 700;
    mocks.invoke.mockResolvedValue({ path: '/recordings/audio.mp4', unavailableReason: null });
  });

  it('loads the next transcript page when playback passes the loaded timestamps', async () => {
    const onLoadMore = vi.fn().mockResolvedValue(undefined);
    render(panel({ onLoadMore }));

    expect(onLoadMore).not.toHaveBeenCalled();
    await enableFollowing();

    await waitFor(() => expect(onLoadMore).toHaveBeenCalledOnce());
  });

  it('does not load another page while playback is within the loaded timestamps', async () => {
    mocks.currentTime = 500;
    const onLoadMore = vi.fn().mockResolvedValue(undefined);
    render(panel({ onLoadMore }));

    await enableFollowing();

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('does not duplicate a request while the next page is loading', async () => {
    const onLoadMore = vi.fn().mockResolvedValue(undefined);
    render(panel({ onLoadMore, isLoadingMore: true }));

    await enableFollowing();

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('loads successive pages until a far seek falls within the loaded timestamps', async () => {
    mocks.currentTime = 1_300;
    const onLoadMore = vi.fn().mockResolvedValue(undefined);
    const view = render(panel({ onLoadMore }));
    await enableFollowing();
    await waitFor(() => expect(onLoadMore).toHaveBeenCalledTimes(1));

    view.rerender(panel({ onLoadMore, segments: makeSegments(200), loadedCount: 200 }));
    await waitFor(() => expect(onLoadMore).toHaveBeenCalledTimes(2));

    view.rerender(panel({ onLoadMore, segments: makeSegments(300), loadedCount: 300 }));
    expect(onLoadMore).toHaveBeenCalledTimes(2);
  });
});
