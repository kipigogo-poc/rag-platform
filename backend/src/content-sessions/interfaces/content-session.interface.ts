export interface NoteSection {
  heading: string;
  content: string;
}

export interface Notes {
  title: string;
  summary: string;
  keyPoints: string[];
  sections: NoteSection[];
}

export interface QuizOption {
  label: 'A' | 'B' | 'C' | 'D';
  text: string;
}

export interface QuizQuestion {
  question: string;
  options: QuizOption[];
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
}

export interface ContentSession {
  id: string;
  sessionId: string;
  userId: string;
  subjectId: string;
  fileName: string;
  notes: Notes;
  quiz: QuizQuestion[];
  createdAt: string;
}
