export type TutorState = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';

export type TranscriptRole = 'tutor' | 'you' | 'system';

export type TranscriptMessage = {
  id: string;
  role: TranscriptRole;
  text: string;
  partial?: boolean;
};

export type VisualizationData = {
  title: string;
  caption?: string;
  analogy?: string;
  svg: string;
  loading?: boolean;
};

export type VizToolArgs = {
  title: string;
  concept: string;
  visual_type: string;
  elements: Array<{ label: string; detail?: string }>;
  analogy?: string;
  caption: string;
};
