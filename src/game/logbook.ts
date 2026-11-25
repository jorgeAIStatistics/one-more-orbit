// The Keeper's logbook: a lighthouse keeper's log, a chapter for each thing done. Optional, under a minute a chapter,
// a few short pages each. Nothing in it is the only place a plot beat lives. (World 1's first two chapters; the rest
// come with their planets.)
export interface Chapter {
  id: string;
  title: string;
  /** what opens it: the prologue, or a level cleared */
  after: 'prologue' | string;
  /** pages, each a few short paragraphs (no more than ninety words a page) */
  pages: string[][];
}
export const LOGBOOK: Chapter[] = [
  {
    id: 'spark', title: 'The spark', after: 'prologue',
    pages: [
      ['Dusk. Lamp trimmed, glass wiped, nothing to report.', 'Struck the wick too hard. A spark came off it and did not go out. It sat on the sill and looked at the lamp as though the lamp owed it something.'],
      ['I have named it Eko, because it answers.', 'It cannot keep time yet. Neither could I. I count for it, out loud, like a fool: one, two, three, four. It comes in on five.'],
      ['Tonight it came in on one.', 'I did not say anything. One does not praise a spark; it goes to its head, and its head is all it has.', 'Lamp steady. The four are humming. A quiet night, the kind I no longer trust.']
    ]
  },
  {
    id: 'ossa', title: 'What Ossa is owed', after: 'heroes',
    pages: [
      ['The first glass of this lamp was cast on Emberwick, in the big forge, by Ossa, who does not make a thing twice.', 'I asked the price. Ossa said: keep it lit.'],
      ['That was the whole bargain. I have paid it every dusk since, and Ossa has never once looked up to check.', 'I find that harder to bear than if it had.'],
      ['When the hills went quiet I could see it from here, banked down like a coal under ash. The spark went in anyway.', 'I heard the anvil. All the way up here.', 'It has given Eko a coal. It gave me a lamp. We are both in its debt, and it will never mention it.']
    ]
  }
];
