# Meetily

A privacy-first meeting assistant that captures, transcribes and summarises meetings entirely on the user's own machine.

## Language

### Capture

**Channel**:
One of the two physical audio sources a recording captures — the microphone or the system output.
_Avoid_: Input/output, track, source

**Channel Attribution**:
Deciding who spoke by which Channel the audio arrived on. Requires no model and cannot be wrong about the Channel itself, but says nothing about who is speaking when a Channel carries more than one person.
_Avoid_: Stream detection, side detection

### Speaker attribution

**Speaker**:
One distinct voice within a single meeting. Speakers are anonymous and meeting-local — the same person in two meetings is two unrelated Speakers.
_Avoid_: Participant, person, voice, attendee

**Turn**:
An uninterrupted stretch of one Speaker talking. Turns are short — a second or two is typical.
_Avoid_: Utterance, speech region

**Segment**:
A unit of transcribed text with a start and end time. Segments come from transcription and are far coarser than Turns, so one Segment routinely spans several Speakers.
_Avoid_: Chunk, block, line

**Diarization**:
Deciding who spoke by clustering distinct voices within a Channel into Speakers. Fallible, and always subordinate to Channel Attribution where the two disagree.
_Avoid_: Speaker detection, voice ID, speaker separation

**Abstention**:
Declining to name a Speaker for a Segment rather than guessing. An unattributed Segment is a correct answer; a confidently wrong one is not.
_Avoid_: Unknown speaker, low confidence, fallback
