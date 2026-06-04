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
