// The cast of single-player opponents and everything they can say.
// Placeholders: {x} target, {y} second person, {h} the human player, {me} the speaker,
// {card} the speaker's card, {n} a night number, {list} a list of findings.

import { MORE_LINES, MORE_PERSONA } from './botlines-more.js';
import { EXTRA_LINES, EXTRA_PERSONA } from './botlines-extra.js';

// Same faces every game. Tables smaller than 12 seat the first N (in this order).
export const CAST = [
  { name: 'Vinnie', title: 'The Enforcer', persona: 'tough', talk: 0.62, aggro: 0.8, trust: 0.45, sly: 0.35,
    look: { suit: 6, pattern: 1, tie: 0, extra: 1, hat: 0, hatColor: 0, hair: 0, hairColor: 0, skin: 2, eyes: 1, eyeColor: 0, facial: 1, mouth: 3, wear: 0 } },
  { name: 'Rosa', title: 'The Bookkeeper', persona: 'sharp', talk: 0.66, aggro: 0.55, trust: 0.3, sly: 0.75,
    look: { suit: 9, pattern: 0, tie: 7, extra: 2, hat: 4, hatColor: 0, hair: 6, hairColor: 0, skin: 1, eyes: 0, eyeColor: 3, facial: 0, mouth: 6, wear: 1 } },
  { name: 'Sal', title: 'The Nose', persona: 'nervous', talk: 0.78, aggro: 0.3, trust: 0.7, sly: 0.2,
    look: { suit: 4, pattern: 3, tie: 1, extra: 0, hat: 2, hatColor: 2, hair: 1, hairColor: 1, skin: 3, eyes: 2, eyeColor: 1, facial: 2, mouth: 4, wear: 0 } },
  { name: 'Dolores', title: 'The Songbird', persona: 'dramatic', talk: 0.72, aggro: 0.55, trust: 0.5, sly: 0.6,
    look: { suit: 8, pattern: 0, tie: 5, extra: 1, hat: 4, hatColor: 0, hair: 6, hairColor: 3, skin: 0, eyes: 3, eyeColor: 2, facial: 0, mouth: 7, wear: 0 } },
  { name: 'Lucky Lou', title: 'The Gambler', persona: 'joker', talk: 0.8, aggro: 0.45, trust: 0.55, sly: 0.5,
    look: { suit: 5, pattern: 2, tie: 4, extra: 3, hat: 3, hatColor: 4, hair: 3, hairColor: 4, skin: 1, eyes: 5, eyeColor: 3, facial: 0, mouth: 2, wear: 0 } },
  { name: 'Frankie', title: 'Nine-Fingers', persona: 'grumpy', talk: 0.46, aggro: 0.6, trust: 0.35, sly: 0.45,
    look: { suit: 0, pattern: 0, tie: 2, extra: 0, hat: 1, hatColor: 0, hair: 2, hairColor: 0, skin: 4, eyes: 1, eyeColor: 4, facial: 5, mouth: 5, wear: 5 } },
  { name: 'Mae', title: 'The Landlady', persona: 'wise', talk: 0.52, aggro: 0.38, trust: 0.45, sly: 0.5,
    look: { suit: 2, pattern: 3, tie: 7, extra: 4, hat: 4, hatColor: 0, hair: 4, hairColor: 5, skin: 3, eyes: 0, eyeColor: 1, facial: 0, mouth: 6, wear: 1 } },
  { name: 'Tommy', title: 'The Rookie', persona: 'rookie', talk: 0.6, aggro: 0.3, trust: 0.78, sly: 0.2,
    look: { suit: 1, pattern: 0, tie: 1, extra: 0, hat: 2, hatColor: 3, hair: 1, hairColor: 2, skin: 0, eyes: 2, eyeColor: 3, facial: 0, mouth: 0, wear: 0 } },
  { name: 'Bugsy', title: 'The Hothead', persona: 'hothead', talk: 0.76, aggro: 0.9, trust: 0.5, sly: 0.3,
    look: { suit: 3, pattern: 1, tie: 0, extra: 0, hat: 0, hatColor: 2, hair: 0, hairColor: 3, skin: 1, eyes: 1, eyeColor: 0, facial: 3, mouth: 3, wear: 0 } },
  { name: 'Carmela', title: 'The Widow', persona: 'charming', talk: 0.6, aggro: 0.45, trust: 0.4, sly: 0.82,
    look: { suit: 6, pattern: 0, tie: 7, extra: 2, hat: 5, hatColor: 0, hair: 6, hairColor: 0, skin: 2, eyes: 3, eyeColor: 5, facial: 0, mouth: 7, wear: 2 } },
  { name: 'Doc', title: 'The Professor', persona: 'analyst', talk: 0.5, aggro: 0.5, trust: 0.28, sly: 0.5,
    look: { suit: 7, pattern: 3, tie: 3, extra: 3, hat: 4, hatColor: 0, hair: 5, hairColor: 5, skin: 5, eyes: 0, eyeColor: 4, facial: 4, mouth: 0, wear: 4 } },
];

// Nicknames people might type
export const ALIASES = {
  'Vinnie': ['vinnie', 'vinny', 'vin', 'enforcer'],
  'Rosa': ['rosa', 'rose', 'bookkeeper'],
  'Sal': ['sal', 'sally', 'nose'],
  'Dolores': ['dolores', 'dolly', 'dee', 'songbird'],
  'Lucky Lou': ['lucky', 'lou', 'luck', 'gambler'],
  'Frankie': ['frankie', 'frank', 'franky', 'nine'],
  'Mae': ['mae', 'may', 'landlady'],
  'Tommy': ['tommy', 'tom', 'rookie', 'kid'],
  'Bugsy': ['bugsy', 'bugs', 'hothead'],
  'Carmela': ['carmela', 'carm', 'mela', 'widow'],
  'Doc': ['doc', 'professor', 'prof'],
};

// Little verbal habits, used on some lines
export const TICS = {
  tough: { pre: ['Listen here. ', 'Look. ', 'Here\'s the deal. '], post: [' Capisce?', ' End of story.', ' You heard me.'] },
  sharp: { pre: ['Let\'s be precise. ', 'The numbers say it. ', 'Think about it. '], post: [' Do the math.', ' It adds up.'] },
  nervous: { pre: ['I-I mean... ', 'Oh boy. ', 'Um. ', 'Okay okay okay. '], post: [' ...right?', ' I think.', ' Don\'t look at me like that.'] },
  dramatic: { pre: ['Darling, ', 'Oh, please. ', 'Honestly. '], post: [' How tragic.', ' The drama of it all.'] },
  joker: { pre: ['Hah! ', 'Well, well, well. ', 'Here\'s a tip: '], post: [' Place your bets.', ' Odds are good.', ' I\'d put money on it.'] },
  grumpy: { pre: ['Ugh. ', 'Pfft. ', 'Great. '], post: [' Whatever.', ' Wake me when it\'s over.'] },
  wise: { pre: ['Honey, ', 'Sweetheart, ', 'Mark my words. '], post: [' I\'ve seen it before.', ' Trust your elders.'] },
  rookie: { pre: ['Uh, ', 'Gee, ', 'Um, '], post: [' Is that how this works?', ' I think?'] },
  hothead: { pre: ['Hey! ', 'Oh, come ON. ', 'You know what? '], post: [' I swear!', ' Unbelievable!'] },
  charming: { pre: ['Sweetheart, ', 'Oh, darling, ', 'Between you and me, '], post: [' Trust me.', ' Mm-hm.'] },
  analyst: { pre: ['Statistically, ', 'Consider this. ', 'Logically, '], post: [' Q.E.D.', ' The evidence is clear.'] },
};

export const LINES = {
  // ------------------------------------------------------------ lobby & deal
  lobbyGreet: [
    'Evening, {h}. Pull up a chair.', 'Look who walked in. Sit down, {h}, the cards don\'t bite.', 'Another player. Good. The pot\'s been lonely.',
    'Welcome to the back room, {h}. Leave your badge at the door.', 'Take a seat, {h}. Don\'t mind the smoke.', '{h}! We were just talking about you.',
    'Shut the door behind you, {h}. It\'s raining cats and Jokers.', 'Grab a glass, {h}. It\'s going to be a long night.',
  ],
  lobbyChat: [
    'Somebody deal already.', 'Who spilled bourbon on the felt?', 'I got a good feeling about tonight.', 'Last time we played, nobody trusted anybody.',
    'Remember the rules: lie well, die well.', 'This rain\'s never going to stop.', 'Anyone seen my lighter?', 'Cards, please. My patience is short.',
  ],
  greet: [
    'Alright. Let\'s see who\'s lying tonight.', 'Cards are out. Keep your poker faces on.', 'Somebody at this table is a Joker. Could be anybody.',
    'Nobody look at their card too long. It\'s a tell.', 'Good luck, everybody. Some of you will need it more than others.', 'Here we go again.',
    'Deal me in. And keep your hands where I can see them.', 'Let\'s make this quick. I\'ve got a train at dawn.', 'I\'m watching all of you.',
  ],

  // ------------------------------------------------------------ Joker night chat
  mafiaSuggest: [
    '{x}. Tonight.', 'I say we visit {x}.', '{x} is getting too close. Let\'s take care of it.', 'How about {x}? Nobody will miss them.',
    '{x}. Quiet and clean.', 'My vote\'s {x}. Any objections?', '{x} has been watching me. Let\'s end that.', 'Let\'s put {x} to sleep. Permanently.',
  ],
  mafiaSuggestHuman: [
    '{h}, I\'m thinking {x}. You in?', 'What do you say, {h}? {x}?', '{h}, pick one. I\'d go with {x}.', 'Partner, how about {x} tonight?',
  ],
  mafiaFollow: ['{x} it is.', 'Fine by me. {x}.', 'Done. {x} won\'t see the morning.', 'Agreed. {x}.', 'Good choice. {x}.', 'Consider it handled.'],
  mafiaAckHuman: [
    '{x}? Consider it done, {h}.', 'You got it. {x} sleeps with the fishes.', '{x}. Nice pick, partner.', 'Smart. {x} was trouble.',
    'Say no more. {x}.', 'I like the way you think, {h}. {x} it is.',
  ],
  mafiaAskHuman: ['{h}, who do you want gone?', 'Your call tonight, partner.', 'Who\'s bothering you, {h}? Name them.', '{h}, give me a name.'],
  mafiaWorried: [
    '{x} is onto us. Watch yourself.', 'Careful tomorrow. {x} keeps looking my way.', 'If {x} claims King, we\'re in trouble.',
    'We need to steer the vote away from us tomorrow.', 'Keep your head down tomorrow, partner.',
  ],
  mafiaChat: [
    'Nice and quiet tonight.', 'Nobody suspects a thing.', 'Stick to the story tomorrow.', 'I\'ll act shocked in the morning.', 'Let\'s not get sloppy.',
    'Remember: blend in. Accuse someone boring.', 'If they come for you, I\'ll throw some doubt around.', 'This town\'s ours by the weekend.',
  ],
  mafiaMorning: ['Act natural.', 'Poker faces, everyone.', 'Here comes the sun. Look sad.'],

  // ------------------------------------------------------------ dawn
  deathReact: [
    'Poor {x}. Nobody deserves to go like that.', '{x}... Rest easy, pal.', 'They got {x}. Somebody here has blood on their hands.',
    'Not {x}! Who would do this?', 'Another chair empty. {x}, we\'ll get them.', 'So much for {x}.', '{x} didn\'t deserve that.',
    'Somebody\'s going to pay for {x}.', 'Well. {x} won\'t be joining us for breakfast.', 'I liked {x}. That\'s the worst part.',
  ],
  deathReactKing: [
    'They got the King. Now we\'re flying blind.', '{x} was our King and they took the badge first. They knew.', 'The Sheriff\'s dead. The Jokers are getting bold.',
    'There goes our only honest badge.',
  ],
  deathReactAccuser: ['{x} was onto somebody. And now {x}\'s gone. Think about that.', '{x} named names yesterday. Funny how that works out.'],
  savedReact: [
    'Somebody\'s got a guardian angel.', 'The Ace came through. Nobody died.', 'Somebody up there likes us.', 'A shot in the dark, and it missed. Lucky us.',
    'Whoever the Ace is: keep it up.', 'The Jokers swung and missed. Ha!',
  ],
  quietReact: ['A quiet night. I don\'t trust quiet.', 'Nobody died. That\'s either good news or a trick.', 'Everybody\'s still breathing. For now.'],
  firstDay: [
    'Alright. Who looks nervous?', 'First day. Nobody knows anything, so everybody watch everybody.', 'Let\'s start talking. Liars slip up when they talk.',
    'Somebody say something suspicious. Please.', 'I\'ve got nothing yet. Let\'s hear from the quiet ones.', 'Let\'s go around the table. Who are you and what do you know?',
  ],

  // ------------------------------------------------------------ day: opinions
  accuse: [
    'I\'ve got my eye on {x}. {reason}', 'I\'m calling it: {x}. {reason}', '{x}. {reason}', 'Let\'s talk about {x}. {reason}',
    'You want a name? {x}. {reason}', 'My gut says {x}. {reason}', 'I don\'t like {x}. {reason}', '{x} is my pick. {reason}',
    'Somebody explain {x} to me. {reason}', 'If I\'m wrong about {x}, I\'ll eat my hat. {reason}',
  ],
  accuseStrong: [
    '{x} is a Joker. I\'d bet my life on it. {reason}', 'Vote {x}. No more games. {reason}', 'It\'s {x}. It\'s been {x} all along. {reason}',
    'We hang {x} today. {reason}',
  ],
  r_quiet: ['{x} has barely said a word.', 'Awfully quiet over there, {x}.', 'Silent types make the best Jokers.', '{x} hasn\'t said one useful thing.'],
  r_votedTown: ['{x} voted to hang {y}, and {y} was innocent.', 'Yesterday {x} pushed {y} onto the gallows. {y} was clean.', '{x} led the charge against {y}. Look how that turned out.'],
  r_defendedMafia: ['{x} stuck up for {y}, and {y} was a Joker.', '{x} was awfully cozy with {y}. You all saw {y}\'s card.', 'Birds of a feather: {x} defended {y}, and {y} was dirty.'],
  r_sheriff: ['The King checked {x}. That\'s good enough for me.', 'Our Sheriff named {x}. I\'m listening to the badge.', '{y} checked {x} and came up Joker.'],
  r_accusedMe: ['{x} keeps pointing at me. Guilty dogs bark loudest.', '{x} is working awful hard to get me hanged.', 'Why is {x} so desperate to blame me?'],
  r_counterClaim: ['{x} claimed King after the real one did. Convenient.', 'Two Kings at one table? {x} is the fake.', '{x}\'s story about being the King doesn\'t hold water.'],
  r_victimAccused: ['{y} was onto {x}, and now {y}\'s dead.', 'Remember who {y} suspected before the night? {x}.'],
  r_bandwagon: ['{x} jumped on the vote at the last second.', '{x} voted late, with the crowd. Safe and sneaky.'],
  r_gut: ['Call it a hunch.', 'Something about {x} smells like a Joker.', 'I just don\'t trust that face.', 'Too calm. Nobody\'s that calm.', 'Call it instinct.'],
  r_skipper: ['{x} keeps voting to skip. Who benefits from that?', 'Every time we try to act, {x} says skip.'],
  r_protectsOthers: ['{x} keeps changing the subject whenever {y} comes up.', 'Every time we get close to {y}, {x} jumps in.'],
  r_defendMe: [],

  agree: [
    '{y}\'s right about {x}.', 'I was thinking the same thing, {y}. {x} is off.', 'Yeah. {x}. I\'m with {y}.', 'Finally someone said it. {x}.',
    '{y} makes a good point. I\'m watching {x} too.', 'Count me in on {x}.',
  ],
  disagree: [
    'Nah, {y}. {x} is clean. I\'d bet my hat on it.', 'Easy, {y}. You\'re barking up the wrong tree with {x}.', 'I don\'t buy it, {y}. Why {x}?',
    '{x}? No. Look somewhere else, {y}.', 'You\'re wrong about {x}, {y}.', 'Slow down, {y}. {x} hasn\'t done anything shady.',
  ],
  defendSelf: [
    'Me? I\'m a {card}, I swear on my mother.', 'You\'ve got the wrong one. I\'m just a {card}.', 'Whoa, whoa. I\'m on your side here.',
    'I\'m clean! Look somewhere else.', 'If you hang me, you\'re hanging a {card}. Don\'t waste the vote.', 'That\'s rich. I\'ve been the most honest one here.',
    'Accuse me all you want. My card says {card}.', 'I\'m not your Joker. Check the quiet ones.',
  ],
  defendSelfMafia: [
    'Me? You\'ve got the wrong person. Check your math.', 'I\'m just a {card}, pal. Relax.', 'That\'s a Joker move: blame the honest one. Hmm, {x}?',
    'Cute theory. Wrong person.', 'I\'ve been trying to find the Jokers all day. Why would I be one?', 'You want to waste a vote on me? Be my guest. You\'ll regret it.',
    'Accusing me is exactly what a Joker would do, {x}.',
  ],
  counterAccuse: [
    'Funny, {x}. I was about to say the same about you.', 'Awfully eager to hang me, {x}. Why is that?', 'Point that finger at yourself, {x}.',
    'You\'re nervous, {x}. I can smell it.',
  ],
  defendOther: [
    'Leave {x} alone. {x} is solid.', 'I trust {x}. Look elsewhere.', '{x}\'s been helping us all game.', 'If {x} is a Joker, I\'m the Pope.',
    'Not {x}. Trust me on this one.',
  ],
  thanksDefend: ['Thanks, {x}. Somebody here has sense.', 'Appreciate it, {x}.', '{x} gets it.', 'See? {x} knows.'],
  question: [
    '{x}, what\'s your read?', 'Who\'s got a theory? Anyone?', '{x}, you\'ve been quiet. Who do you like for it?', 'Somebody give me a name.',
    '{x}, where were you last night?', 'Come on, {x}. Talk.',
  ],
  humanQuiet: ['{h}, you\'ve been quiet. Spill it.', 'What about you, {h}? Who\'s your pick?', '{h}, say something. Silence looks guilty.', '{h}? Hello? We\'re talking about Jokers here.'],
  answerWho: ['My money\'s on {x}.', 'If I had to pick? {x}.', '{x}. {reason}', 'I keep coming back to {x}.', 'Honestly? {x}.'],
  answerNone: ['Too early to say.', 'I don\'t know yet. Nobody\'s slipped.', 'I\'m still watching.', 'No idea. That\'s the scary part.', 'Ask me after the next body.'],
  answerTrust: ['{x}? I trust {x}. For now.', '{x} seems alright to me.', 'I\'d vouch for {x}.', '{x}\'s one of the good ones, I think.'],
  answerDistrust: ['{x}? Not one bit.', 'I don\'t trust {x} as far as I can throw them.', '{x} is on my list. Top of it.'],
  banter: [
    'Rain\'s coming down hard tonight.', 'This bourbon tastes like regret.', 'Somebody crack a window. Oh wait, it\'s pouring.', 'I should\'ve stayed home tonight.',
    'Anybody else hear footsteps upstairs?', 'This town used to be nice.', 'You ever notice the clock never seems to move in here?',
    'If I survive this I\'m moving to Miami.', 'Whoever keeps kicking me under the table: stop.', 'I\'ve seen friendlier faces in a lineup.',
  ],
  pressure: ['Clock\'s ticking. Let\'s pick someone.', 'We\'re wasting time. Names!', 'Less talking, more deciding.', 'Vote soon or the Jokers win by default.'],
  readyVote: ['I\'ve heard enough. Let\'s vote.', 'Ready when you are. Let\'s vote.', 'Let\'s get this over with. Vote.', 'I know who I\'m voting for.'],

  // ------------------------------------------------------------ claims
  kingClaimMafia: [
    'I\'m the King. I checked {x}. {x} is a JOKER.', 'Listen up: I\'m the Sheriff. {x} is Mafia. I saw the card myself.',
    'Time to show my hand. I\'m the King, and {x} is a Joker.', 'Badge on the table: I\'m the King. {x} came up Joker. Vote {x}.',
  ],
  kingClaimClean: ['I\'m the King. {x} is clean. I checked.', 'I\'m the Sheriff. I looked at {x}: not a Joker.', 'King here. {x} is innocent. Stop wasting time on them.'],
  kingList: ['My checks so far: {list}.', 'Here\'s everything I\'ve got: {list}.'],
  fakeClaim: [
    'Hold it. I\'M the King. And I checked {x}: Joker.', 'That\'s a lie. I\'m the real King, and {x} is the Joker.', 'Two Kings? One of us is lying, and it isn\'t me. {x} is Mafia.',
    'Nice try, {x}. I\'m the Sheriff. And I checked YOU.',
  ],
  fakeClaimClean: ['I\'m the King, actually. {x} is clean. I checked last night.', 'Sheriff here. {x} is innocent, so back off.'],
  claimBelieve: ['A King at the table. I\'ll follow your lead.', 'Alright, badge. I believe you.', 'Finally, some real information.', 'If {x} is the King, I\'m listening.'],
  claimDoubt: [
    'Two Kings? One of you is lying through your teeth.', 'Convenient time to become the King, {x}.', 'I\'ll believe you\'re the King when your story holds up for another day.',
    'Anybody can say they\'re the King, {x}.',
  ],
  angelClaim: ['I\'m the Ace. I saved {x} on night {n}.', 'I\'m the Angel. {x} is alive because of me.', 'Ace here. I kept {x} breathing. Don\'t make me regret it.'],
  angelClaimPlain: ['I\'m the Ace. I\'ve been protecting you all.', 'I\'m the Angel. Hang me and nobody\'s safe at night.'],
  civClaim: ['I\'m just a {card}. Nothing special.', 'Number card. {card}. That\'s all I\'ve got.', 'I\'m a plain {card}. No powers, no secrets.'],

  // ------------------------------------------------------------ replies to the human
  replyGreet: ['Evening, {h}.', 'Hey, {h}.', '{h}. Good to see a face I can almost trust.', 'Hello yourself, {h}.', 'Hi, {h}. Keep your cards close.'],
  replyThanks: ['Don\'t mention it.', 'Any time, {h}.', 'You owe me one.', 'Sure thing.'],
  replyInsult: ['Watch your mouth, {h}.', 'Big words from someone who might be a Joker.', 'Charming, {h}. Really.', 'Keep talking like that and see who votes for you.'],
  replyLaugh: ['Glad somebody\'s enjoying this.', 'Laugh now, {h}.', 'Heh.', 'You won\'t be laughing at the vote.'],
  replyAgree: ['Now we\'re talking.', 'Good. Then let\'s act on it.', 'Glad we agree, {h}.'],
  replyConfused: ['Come again, {h}?', 'Say that in English, {h}.', 'I didn\'t follow that.', 'Huh?'],
  replyPleaBelieve: ['Alright, {h}. I believe you. For now.', 'Fine, {h}. I\'ll look elsewhere.', 'I hear you, {h}.'],
  replyPleaDoubt: ['That\'s what a Joker would say, {h}.', 'Everybody says that, {h}.', 'Prove it, {h}.', 'Sure you are, {h}.'],
  replyHumanClaimKing: ['The King, huh? Who\'d you check, {h}?', 'A badge! Alright {h}, tell us what you found.', 'If you\'re the King, {h}, give us a name.'],
  replyHumanClaimKingDoubt: ['You\'re the King too, {h}? One of you is lying.', 'Funny, {h}. {x} already said they\'re the King.'],
  replyHumanClaimAce: ['An Ace? Careful saying that out loud, {h}. You\'re a target now.', 'The Angel? Then keep us alive, {h}.'],
  replyHumanClaimCiv: ['A number card. Welcome to the club, {h}.', 'Alright, {h}. Plain as bread.'],
  replyHumanResultMafia: ['{x} a Joker? Then that settles it.', 'You heard the King. {x} it is.', 'I knew something was off about {x}!'],
  replyHumanResultMafiaDoubt: ['{x}? I\'m not convinced, {h}.', 'Easy, {h}. I\'m not hanging {x} on your word alone.'],
  replyHumanResultClean: ['Clean? Alright, {x} is off my list.', 'Good to know about {x}.', 'Fine. {x} lives another day.'],
  replySkip: ['Skipping just helps the Jokers, {h}.', 'A skip is a free night for the Mafia.', 'Skip? And let them kill again?'],
  replyVoteOther: ['{x}? Maybe. Give me a reason, {h}.', 'I could see {x}. Go on, {h}.', 'Hm. {x}. Not a bad shout.'],
  replyVoteOtherAgree: ['Agreed, {h}. {x} has been shady.', 'Took the words out of my mouth. {x}.', '{x}. Yeah. I\'m with you, {h}.'],
  replyVoteOtherDisagree: ['{x}? No way, {h}.', 'Wrong tree, {h}. {x} is fine.', 'Why {x}? That makes no sense, {h}.'],
  replyAccusedByHuman: ['Me? You\'ve got it backwards, {h}.', 'Why me, {h}? Give me one reason.', 'That\'s funny coming from you, {h}.', 'Okay {h}, now I\'m suspicious of YOU.'],
  replyWhyMe: ['Because {reason}', 'You know why, {h}. {reason}', 'Simple: {reason}'],
  replyAskMe: ['What do you want, {h}?', 'Yeah, {h}?', 'I\'m listening.'],

  // ------------------------------------------------------------ vote
  voteFor: ['My vote\'s on {x}.', '{x}. Sorry, pal.', 'I\'m voting {x}.', '{x}. Nothing personal.', 'Goodbye, {x}.', 'It\'s {x} for me.'],
  voteSkip: ['I\'m not hanging anyone on a hunch. Skip.', 'Skip. Not enough to go on.', 'I\'ll sit this one out.'],
  voteSwitch: ['Changing my vote. {x}.', 'Alright, I\'m switching to {x}.', 'On second thought: {x}.'],
  voteReactOnMe: ['You\'re making a big mistake!', 'Me?! Look at the evidence!', 'You\'ll regret this.', 'I\'m innocent, you fools!'],

  // ------------------------------------------------------------ last words
  lastTown: [
    'I\'m a {card}! You\'re killing an innocent!', 'Remember this when the next body drops. I was a {card}.', 'You got the wrong one. Find them. Please.',
    'Fine. But the Jokers are laughing at you right now.', 'I was on your side. I hope you figure it out.',
  ],
  lastMafia: [
    'Heh. Took you long enough.', 'You got me. But you\'re not done yet.', 'I\'m innocent. You\'ll see.', 'Enjoy it while it lasts.',
    'Congratulations. You found one.', 'I regret nothing. Well, maybe the bourbon.',
  ],
  lastKing: ['I\'m the King! {list}. Remember that!', 'You just hanged your Sheriff. My checks: {list}.'],
  lastAngel: ['I\'m the Ace. Who\'s going to save you now?', 'I was your Angel. Good luck tonight.'],

  // ------------------------------------------------------------ verdicts
  execMafia: ['One Joker down!', 'Got you.', 'That\'s one for the good guys.', 'See? I told you.', 'The town bites back!'],
  execTown: ['We just hanged an innocent. Great work, everybody.', 'That was a {card}... we messed up.', 'Wrong one. The Jokers are laughing.', 'Oh no. Oh no no no.'],
  execTownBlame: ['{x} pushed that vote. Remember that.', 'Who started that? {x}. Hmm.'],
  noExec: ['Nobody hangs today. The Jokers thank you.', 'A split vote. Lovely.', 'All that talk and nothing to show for it.'],

  // ------------------------------------------------------------ end
  winTown: ['The streets are ours again!', 'Good game. Justice, for once.', 'We did it. Drinks on me.', 'Not bad for a bunch of number cards.'],
  winMafia: ['This town belongs to us now.', 'Too easy.', 'Nobody saw it coming. Nobody ever does.', 'Hah! Deal \'em again.'],
  loseTown: ['They got us. Good game, Jokers.', 'Next time, I\'m trusting nobody.', 'Well played. I hate it.'],
  loseMafia: ['You got lucky.', 'Next time, the house wins.', 'Fine. Good game.'],

  // ------------------------------------------------------------ the dead
  ghostChat: [
    'It\'s cold on this side of the table.', 'From up here I can see every card. Oh, this is good.', 'I can\'t believe they hanged me.',
    'At least the bourbon was good.', 'Being dead is surprisingly relaxing.', 'Watch them squirm.',
  ],
  ghostReveal: ['Psst. {x} is a Joker. Wish I\'d known.', 'Look at {x}\'s card. Unbelievable.', '{x} was the Joker the whole time?!'],
  ghostReply: ['Welcome to the graveyard, {h}.', 'Pull up a cloud, {h}.', 'Hey {h}. Rough night?', 'We can only watch now, {h}.'],
};

// A few lines only certain people say (mixed in with the shared pool, weighted up)
export const PERSONA_LINES = {
  tough: {
    accuse: ['{x}, I\'ve broken bigger liars than you. {reason}', 'I don\'t need a reason to dislike {x}, but I got one. {reason}'],
    defendSelf: ['You calling ME a Joker? Say it slower.', 'I\'ve got a {card} and a short temper. Pick another target.'],
    banter: ['Anybody wants trouble, I\'m right here.', 'I\'ve had nicer nights in the drunk tank.'],
    deathReact: ['{x} was tough. Whoever did it is tougher. Or luckier.'],
  },
  sharp: {
    accuse: ['{x} is inconsistent, and inconsistency is a tell. {reason}', 'Follow the votes. They lead to {x}. {reason}'],
    firstDay: ['Day one is about patterns. Talk, and I\'ll listen.', 'Everyone speak. I\'m keeping books.'],
    banter: ['I\'ve balanced ledgers messier than this table.', 'I wrote down every vote. Every single one.'],
  },
  nervous: {
    defendSelf: ['M-me?! No no no, I\'m a {card}! I\'d show you if I could!', 'Why is everyone looking at me? I\'m a {card}, I swear!'],
    banter: ['Is it hot in here? It\'s hot in here.', 'I don\'t like how quiet it is.', 'Did anybody else hear that?'],
    deathReact: ['Oh no. Oh no, {x}. That could\'ve been me.'],
  },
  dramatic: {
    deathReact: ['{x}! Gone, just like that! It\'s a tragedy in three acts!', 'Somebody fetch me a handkerchief. Poor {x}.'],
    accuse: ['{x}, darling, you\'re a terrible actor. {reason}'],
    banter: ['I sang at the Blue Room once. Nobody died that night. Mostly.'],
  },
  joker: {
    accuse: ['I\'d put ten bucks on {x}. {reason}', 'The odds on {x} are looking good. {reason}'],
    banter: ['Anyone want to bet on who dies tonight? Kidding. Mostly.', 'I once won a car at this table. Lost it the same night.'],
    voteFor: ['All in on {x}.', 'Betting it all on {x}.'],
  },
  grumpy: {
    banter: ['Can we speed this up? My feet hurt.', 'I hate every one of you equally.'],
    firstDay: ['Let\'s get this over with.'],
    deathReact: ['{x}. Figures.'],
  },
  wise: {
    accuse: ['I\'ve rented rooms to liars for thirty years, {x}. {reason}'],
    banter: ['You kids and your card games.', 'I remember when this town had manners.'],
    deathReact: ['Rest now, {x}. We\'ll take it from here.'],
  },
  rookie: {
    accuse: ['I-I think it might be {x}? {reason}'],
    defendSelf: ['It\'s my first week! I\'m a {card}, honest!', 'Guys, I don\'t even know how to lie!'],
    banter: ['Is this how grown-up card games always go?', 'My ma said this town was dangerous.'],
  },
  hothead: {
    accuse: ['{x}! It\'s {x}! I KNOW it! {reason}', 'Vote {x} or I flip this table! {reason}'],
    defendSelf: ['Say that again, I dare you! I\'m a {card}!', 'You want to hang ME? Over my dead body! Wait.'],
    banter: ['Somebody better confess before I lose it.'],
  },
  charming: {
    accuse: ['{x}, sweetheart, your smile doesn\'t reach your eyes. {reason}'],
    defendSelf: ['Me? Darling, I couldn\'t hurt a fly. I\'m a {card}.'],
    banter: ['Such handsome company tonight. Shame about the murders.'],
  },
  analyst: {
    accuse: ['{x} has the highest probability of being a Joker. {reason}', 'Eliminate the impossible. {x} remains. {reason}'],
    firstDay: ['Insufficient data. Everyone, please speak.'],
    banter: ['Fascinating. Every liar blinks more.'],
  },
};

// fold in the second and third books of lines
for (const book of [MORE_LINES, EXTRA_LINES]) {
  for (const [k, v] of Object.entries(book)) LINES[k] = (LINES[k] || []).concat(v);
}
for (const book of [MORE_PERSONA, EXTRA_PERSONA]) {
  for (const [who, keys] of Object.entries(book)) {
    PERSONA_LINES[who] = PERSONA_LINES[who] || {};
    for (const [k, v] of Object.entries(keys)) PERSONA_LINES[who][k] = (PERSONA_LINES[who][k] || []).concat(v);
  }
}
