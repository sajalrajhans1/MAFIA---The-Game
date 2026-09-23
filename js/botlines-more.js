// The big book of table talk, part two. Merged into LINES / PERSONA_LINES by botlines.js.
// Same placeholders: {x} target, {y} second person, {h} the human, {me} the speaker,
// {card} the card the speaker admits to, {n} a night number, {list} findings, {reason} a reason.

export const MORE_LINES = {
  // ------------------------------------------------------------ lobby & deal
  lobbyGreet: [
    "{h}. You made it. Most people don't.", "Well, if it isn't {h}. Sit anywhere, just not in my chair.", "Evening, {h}. Coat on the hook, trust at the door.",
    "Ah, fresh blood. Welcome, {h}.", "{h}, you look like someone with secrets. You'll fit right in.", "Close the door, {h}, you're letting the fog in.",
    "There's an empty chair with your name on it, {h}. Literally. Somebody carved it.", "Just in time, {h}. We were about to start without you.",
    "Hope you brought a poker face, {h}.", "{h}! The regulars were getting bored of each other.", "Mind the step, {h}. And mind the company.",
    "Don't let the smoke fool you, {h}. It's friendly in here. Mostly.", "Hey, {h}. Drinks are on the house. The house is on fire, but still.",
    "Evening, {h}. Nobody here bites. Nobody admits to it, anyway.", "Welcome to the table, {h}. Everybody here is a liar. Some of us just lie for fun.",
  ],
  lobbyChat: [
    "Who ordered the rain? Cancel it.", "My grandmother played this game. She never lost. She also never slept.", "The piano player quit. Said we're bad for his nerves.",
    "Somebody shuffle. And not like last time.", "Heard the Commissioner plays on Tuesdays. Glad it's not Tuesday.", "Keep your elbows off the felt, it's new.",
    "Five bucks says somebody cries tonight.", "I brought my lucky coin. Lost it on the way. Good sign?", "The coffee here could strip paint.",
    "Anybody else get a bad feeling about tonight? No? Just me?", "I swear this table gets smaller every game.", "Remember: the Joker smiles the widest.",
    "We deal when the host says so. Patience.", "The radio says more rain. The radio always says more rain.", "Somebody tell the kid in the corner to stop humming.",
    "Last game I trusted everybody. I didn't make it past night one.", "The house rules are simple: don't cheat, don't cry, don't die.",
  ],
  greet: [
    "Everybody got their card? Good. Don't flash it.", "Look at your card once. Then forget you ever saw it.", "Deep breaths, everyone. The fun part is coming.",
    "Somebody here just drew a Joker and is trying very hard to look bored.", "May the best liar lose.", "Nobody smile. Smiling is suspicious.",
    "Well. That's a card, alright.", "Mine's boring. I hope yours is too.", "Here's to an honest game. Ha. Good one.", "Alright, folks. Let's find the rats.",
    "Everybody keep your hands on the table.", "Interesting. Very interesting. No, I'm not telling.", "I've got a good feeling. That usually means I'm dead by morning.",
    "Let the lying begin.", "Same table, new sins.", "Nobody panic. Yet.",
  ],

  // ------------------------------------------------------------ Joker night chat
  mafiaSuggest: [
    "{x} talks too much. Let's fix that.", "{x}. They've been sniffing around.", "I want {x} gone before they figure us out.", "{x} looks sleepy. Let's make it permanent.",
    "Tonight we take {x}. Clean job.", "{x} has a big mouth and a bigger nose. Tonight.", "Let's do {x}. It'll throw them off the scent.", "{x} is the smart one. So {x} goes first.",
    "{x}. And make it quick.", "Nobody's protecting {x}. I'd bet on it.", "{x} keeps asking the right questions. Can't have that.", "Let's send {x} a message. A permanent one.",
    "{x} is the only one looking at the votes. Let's close that book.", "I've had enough of {x}. Tonight.",
  ],
  mafiaSuggestHuman: [
    "{h}, I've got my eye on {x}. Unless you've got a better idea.", "{h}, {x} is trouble. Your call, partner.", "{x} is sniffing around, {h}. Want to take care of it?",
    "I vote {x}, {h}. You pick if you'd rather.", "{h}. {x}. Tonight. Yes?", "Partner, {x} has been dangerous. Say the word.", "{h}, what about {x}? They're getting too clever.",
  ],
  mafiaFollow: [
    "{x}. Got it.", "Works for me. {x} goes tonight.", "{x}? Fine. They had it coming.", "No complaints. {x}.", "Say goodnight to {x}.", "{x} it is. Quietly.",
    "I'll be right behind you. {x}.", "Deal. {x} won't be at breakfast.", "Right. {x}. Sweet dreams.", "Let's not argue. {x}.",
  ],
  mafiaAckHuman: [
    "{x}. You read my mind, {h}.", "Done deal, partner. {x}.", "{x} it is. Nobody will see it coming.", "Excellent choice, {h}. {x} has been a pain.",
    "I'm with you, {h}. {x} goes.", "{x}? Ha. I was hoping you'd say that.", "Consider {x} handled, partner.", "Right behind you, {h}. {x}.",
  ],
  mafiaAskHuman: [
    "Partner, you pick tonight.", "{h}, who's been bothering you?", "{h}, point and I'll follow.", "Any names, {h}? I'm not fussy.", "What's the plan, {h}?",
    "{h}, whose seat is empty tomorrow?", "Your turn to choose, partner. Make it count.",
  ],
  mafiaWorried: [
    "{x} is getting warm. Too warm.", "I don't like how {x} watches the votes.", "If {x} lives, we're in trouble tomorrow.", "{x} almost had me today. Too close.",
    "Stay calm tomorrow. {x} is fishing.", "{x} knows something. I can feel it.", "Heads down tomorrow. {x} is building a case.",
  ],
  mafiaChat: [
    "Sleep tight, suckers.", "Remember, tomorrow we're outraged. Very outraged.", "Keep your story simple. Simple stories survive.", "Don't defend each other too hard tomorrow.",
    "If I throw you under the bus, it's nothing personal. It's business.", "Blend in. Be boring. Boring lives.", "They're getting nowhere. Good.",
    "I'll start a fight tomorrow. Stay out of it.", "Let's be quick. The Ace could be anywhere.", "One more good night and this town is ours.",
    "They'll blame someone loud. Let them.", "Tomorrow I'm going to accuse you. Lightly. Play along.", "Stay cool. Cool heads win this game.",
  ],
  mafiaMorning: ["Look shocked.", "Tears ready?", "Showtime.", "Nobody grin."],

  // ------------------------------------------------------------ dawn
  deathReact: [
    "{x}? No. Not {x}.", "They took {x}. In the middle of the night like cowards.", "Somebody pour one out for {x}.", "{x} was just here. Just yesterday.",
    "That's cold. {x} didn't even see it coming.", "I owed {x} five bucks. Guess I'll never pay it back.", "Somebody wanted {x} quiet. Why?",
    "{x} is gone and the Jokers are sitting right here with us.", "Rest easy, {x}. We'll find who did it.", "They picked {x}. That tells us something.",
    "Oh, {x}. You poor soul.", "Another one. {x} this time.", "Whoever killed {x}, I hope you choke on your breakfast.", "{x} was harmless. That's what makes it worse.",
    "A moment of silence for {x}. There. Now let's find the killer.", "{x}'s chair is still warm.", "The Jokers didn't pick {x} at random. Think.",
  ],
  deathReactKing: [
    "The King is dead. Long live nobody.", "{x} was the King. They knew exactly where to hit.", "Without {x} we're fumbling in the dark.",
    "They killed the badge. That was a Joker who knew what they were doing.", "{x} was our best shot, and now {x} is gone.", "Sheriff down. Every word {x} said still counts.",
  ],
  deathReactAccuser: [
    "{x} pointed a finger yesterday and didn't wake up. Remember who {x} pointed at.", "{x} got too close to someone. Who was it?",
    "Anybody else notice {x} died right after naming names?", "{x} was onto something. The Jokers agreed, apparently.", "You don't kill someone who's wrong. {x} was right about something.",
  ],
  savedReact: [
    "Nobody's dead? I'll take it.", "The Ace was on the job last night.", "Somebody's guardian angel earned their wings.", "The Jokers missed! Somebody up there is watching.",
    "Well, that must've stung for the Mafia.", "Everyone's alive. Somebody check the Ace a raise.", "Close call for somebody at this table.", "Ha! Not tonight, Jokers.",
  ],
  quietReact: [
    "Nobody died. Weird.", "All present. That's new.", "Quiet night. I slept like a baby. With one eye open.", "The Jokers took the night off? I doubt it.",
    "No bodies. Somebody's planning something.", "Everyone's here. Let's keep it that way.",
  ],
  firstDay: [
    "Okay, everybody. Nobody knows anything, so let's watch who pretends they do.", "Day one. The Jokers want a quiet table. Let's be loud.",
    "Let's all say something. Liars hate being on the record.", "Somebody's heart is pounding right now. I wonder whose.", "Start talking. I'm reading faces.",
    "Let's not hang anyone blind today. Unless someone slips.", "I'll go first: I'm not a Joker. Your turn.", "Who's got a gut feeling? Gut feelings are all we've got.",
    "No clues yet, so let's make some.", "Day one is the hardest. Everybody's innocent and somebody's lying.", "Let's hear from everyone. Especially the quiet corner.",
    "Look for the one who's trying too hard to look normal.",
  ],

  // ------------------------------------------------------------ day: opinions
  accuse: [
    "I'm looking at {x}. {reason}", "Here's my problem with {x}. {reason}", "{x}, I've got questions. {reason}", "Can we talk about {x} for a second? {reason}",
    "I keep coming back to {x}. {reason}", "Put me down for {x}. {reason}", "{x} is bothering me. {reason}", "Not to point fingers, but {x}. {reason}",
    "Fine, I'll say it. {x}. {reason}", "I've got a name, and it's {x}. {reason}", "If there's a Joker at this table, my money says {x}. {reason}",
    "Nobody's talking about {x}. Why not? {reason}", "I'm not sure yet, but {x}. {reason}", "Watch {x}. {reason}", "{x} is too comfortable. {reason}",
    "Something's off with {x}. {reason}", "Let's put {x} under the lamp. {reason}", "{x}, you're making me nervous. {reason}", "Keep an eye on {x}. {reason}",
    "Top of my list: {x}. {reason}", "{x}. I can't shake it. {reason}", "My vote's heading toward {x}. {reason}",
  ],
  accuseStrong: [
    "It's {x}. I'm sure of it. {reason}", "{x} is the Joker. Let's end this. {reason}", "No more dancing. {x}. {reason}", "Everybody vote {x}. {reason}",
    "I'm done guessing. It's {x}. {reason}", "{x} is dirty, and I can prove it. {reason}", "If {x} walks out of this room alive, we lose. {reason}",
    "{x}. Hang {x}. Today. {reason}", "Mark my words, {x} is a Joker. {reason}", "Wake up, people. {x}. {reason}",
  ],
  r_quiet: [
    "{x} has been hiding behind that drink all day.", "Not a peep from {x}. Jokers love silence.", "{x} is keeping their head awfully low.",
    "Every time I look at {x}, {x} is looking at the floor.", "{x} is letting everybody else do the talking. Convenient.", "When was the last time {x} said a single word?",
  ],
  r_votedTown: [
    "{x} helped hang {y}, and {y} was one of us.", "{x} voted for {y}. {y} was innocent. Coincidence?", "Remember {y}'s card? {x} put {y} in the ground.",
    "{x} was first on the {y} wagon. {y} was clean.", "{x}'s vote killed an innocent. I haven't forgotten.",
  ],
  r_defendedMafia: [
    "{x} stood up for {y}. And {y} turned out to be a Joker.", "{x} vouched for {y}. How'd that work out?", "{x} and {y} were thick as thieves. We know what {y} was.",
    "When {y} was in trouble, {x} jumped in. Loyal. Too loyal.", "{x} fought for {y} like family. Maybe they were.",
  ],
  r_sheriff: [
    "The King's word is good enough for me.", "The badge says {x}. I'm not arguing with the badge.", "{y} checked {x}. I'm following the King.",
    "We have a King result on {x}. Why are we still talking?", "{y} put {x} under the lamp and {x} came up Joker.",
  ],
  r_myCheck: [
    "I checked {x} myself. Joker.", "I looked at {x}'s card. I know what I saw.", "I'm the one who checked {x}. It's a Joker.", "My check on {x} came back dirty.",
  ],
  r_accusedMe: [
    "{x} has been gunning for me all day. Why?", "{x} is pushing me hard. Guilty people push hard.", "{x} wants me gone. Ask yourselves why.",
    "{x} keeps saying my name. I'm starting to take it personally.", "Every time I talk, {x} tries to shut me up.",
  ],
  r_counterClaim: [
    "Two Kings at one table? Somebody's lying, and it's {x}.", "{x} claimed the crown second. Real Kings don't wait.", "{x}'s King story fell apart.",
    "{x} is wearing a paper crown.", "The real King spoke first. {x} is the copy.",
  ],
  r_victimAccused: [
    "{y} suspected {x}, and then {y} woke up dead. Or didn't wake up at all.", "The last thing {y} did was point at {x}.", "{y} named {x}. The Jokers made sure {y} couldn't say more.",
  ],
  r_bandwagon: [
    "{x} jumps on every wagon, just never first.", "{x} always votes with the crowd, right at the end.", "{x} never leads, always follows. Safe place for a Joker.",
  ],
  r_heat: [
    "I'm not the only one saying it, either.", "Half this table has a bad feeling about {x}. That's not nothing.", "Everybody's noticed {x}. I'm just saying it out loud.",
    "Three people already smell it on {x}.", "The whole room keeps drifting back to {x}.", "When that many people suspect {x}, there's usually a reason.",
  ],
  r_gut: [
    "Just a feeling. But my feelings are usually right.", "Don't ask me why. I just know.", "{x} has a Joker's poker face.", "{x}'s story is too clean.",
    "Watch {x}'s hands when {x} talks.", "{x} flinched when the cards came out. I saw it.", "{x} laughs at the wrong moments.", "{x} is trying too hard to look bored.",
    "{x} smiled when the body dropped. Just for a second.", "{x} keeps glancing at the door.", "My nose itches whenever {x} talks. That's a sign.",
    "Nothing solid. Just a bad vibe off {x}.", "{x} answers questions nobody asked.", "Something in {x}'s voice. Too smooth.",
  ],
  r_skipper: [
    "{x} wants us to do nothing. Doing nothing helps the Jokers.", "{x} votes skip every chance. Why so shy?", "{x} never wants anybody hanged. Funny, for a town that's dying.",
  ],
  r_protectsOthers: [
    "{x} jumps in every time {y} gets heat.", "{x} guards {y} like a bodyguard.", "{x} can't stand hearing {y}'s name. Interesting.",
  ],

  agree: [
    "{y} is onto something with {x}.", "Listen to {y}. {x} is shady.", "I'll back {y} on this. {x}.", "Me too, {y}. {x} has been off all day.",
    "Good eye, {y}. I've been watching {x} too.", "{y} said it before I could. {x}.", "{y}, you're not crazy. {x} bugs me too.", "Add my name to the list against {x}.",
    "Hard agree, {y}. {x}.", "{y} makes sense. {x} it is, for me.", "I've been thinking about {x} too. {y} is right.", "Two of us now, {y}. {x} should be worried.",
    "Yeah, {x} hasn't passed my smell test either.", "{y}'s got {x} pegged.",
  ],
  disagree: [
    "{y}, you're way off on {x}.", "Hold on, {y}. {x} has been straight with us.", "{x}? Come on, {y}. Be serious.", "I don't see it with {x}, {y}. At all.",
    "Leave {x} out of it, {y}. Look harder.", "Now why would you go after {x}, {y}? Interesting choice.", "{y}, you're wasting our time with {x}.",
    "No. {x} is fine. I'd stake my hat on it.", "{x} isn't our Joker, {y}. Try again.", "That's a stretch, {y}. {x} hasn't done a thing wrong.",
    "Careful, {y}. Throwing mud at {x} looks worse on you.", "{y}, I think you want {x} gone for your own reasons.",
  ],
  defendSelf: [
    "Look at me. Do I look like a Joker? Don't answer that.", "I've got nothing to hide. I'm a {card}.", "You're wasting a vote on a {card}, {x}.",
    "Me? I've been helping this whole game!", "Hang me and you'll feel stupid tomorrow. I'm a {card}.", "I didn't do anything. I'm a plain {card}.",
    "Come on, {x}. I'm clean. Look at somebody who's actually lying.", "Wrong target. I'm town, through and through.", "Save your breath, {x}. I'm not the one.",
    "I'll say it once: {card}. Believe it or don't.", "My hands are clean. Check under somebody else's nails.", "I'm the least interesting card at this table: {card}.",
    "If I were a Joker, would I be this bad at lying?", "Pick someone else. I'm an honest {card}.", "You're barking at the wrong door, {x}.",
  ],
  defendSelfMafia: [
    "Easy there, {x}. I'm just a {card}.", "You've got nothing on me, {x}. Nothing.", "I'm the most honest person at this table, and you know it.",
    "Point at me all you want, {x}. The Jokers are laughing at you.", "Hanging me is exactly what the Jokers want, {x}.", "I'm not worried. I'm a {card}. Vote how you like.",
    "Take a breath, {x}. You're chasing shadows.", "Wow. I've been trying to help, and this is the thanks I get.", "Keep digging, {x}. You won't find anything.",
    "Do what you want, {x}. You'll regret it in the morning.", "I'm town. I've been town all game. Look at my votes.", "Funny, I was going to say the same thing about the person accusing me.",
    "Is it hot in here, {x}, or are you just desperate?", "I'd love to be a Joker. Sounds exciting. Sadly, I'm a {card}.",
  ],
  counterAccuse: [
    "Interesting that you're so quick to blame me, {x}.", "Why are you pushing so hard, {x}? Afraid of something?", "You first, {x}. Show me your card.",
    "Nice try, {x}. Throwing the heat off yourself?", "Look who's talking. {x}, I've been watching you too.", "Accusing me is a clever way to hide, {x}.",
    "Funny how the loudest accuser is always the one with something to hide, {x}.", "{x}, you've been wrong all game. Why start being right now?",
    "Keep pushing, {x}. You're only making yourself look worse.", "I'd worry about your own card, {x}.", "Deflection, {x}. Classic Joker move.",
    "Let's look at {x} for a minute instead of me.",
  ],
  defendOther: [
    "Easy on {x}. {x} has been one of the good ones.", "I'll vouch for {x}. Look elsewhere.", "Not {x}. I'd bet my last dollar.", "Back off {x}. You've got nothing.",
    "{x} has been straight with us all game.", "If {x} is a Joker, I'm the Queen of England.", "Picking on {x} is a waste of a day.", "I trust {x} more than anybody here.",
  ],
  thanksDefend: [
    "Thanks, {x}. At least somebody's paying attention.", "Somebody with sense. Thank you, {x}.", "{x} sees it. Why can't the rest of you?",
    "I owe you one, {x}.", "Glad someone's got my back. Thanks, {x}.", "Listen to {x}. {x} is right.",
  ],
  question: [
    "{x}, who's your top suspect?", "What's your read on the table, {x}?", "{x}, you haven't said much. What's on your mind?", "Anyone else notice anything weird last night?",
    "Who hasn't talked yet? Let's hear from them.", "{x}, who would you vote for right now?", "Okay, everyone: one name each. Go.", "{x}, you look like you know something.",
    "{x}, what's your card? Roughly.", "Who do we trust? Anybody?", "{x}, you've been watching. What did you see?",
  ],
  humanQuiet: [
    "{h}, you're awfully quiet. What's your read?", "{h}, we haven't heard from you. Who do you like for it?", "Come on, {h}, give us a name.",
    "{h}, you've been watching us all. What do you see?", "Your turn, {h}. Who's lying?", "{h}, don't leave us hanging. Speak up.",
    "{h}, I want to hear your take before we vote.", "What does {h} think? Anybody?", "{h}, a quiet mouth makes a busy mind. What's in it?",
    "{h}, you look like you've got a theory. Let's hear it.", "{h}, I'm curious what you're thinking.",
  ],
  answerWho: [
    "{x}, if you're asking. {reason}", "Right now? {x}.", "I'd say {x}. {reason}", "Top of my list is {x}.", "{x}. Don't ask me to explain it. Well, {reason}",
    "Gun to my head, {x}.", "My read is {x}. {reason}", "I'm leaning {x}.", "{x}, easy.", "{x}. And I'm usually right.",
  ],
  answerNone: [
    "Honestly? Nobody stands out yet.", "Still thinking. Everybody looks guilty in this light.", "I've got nothing solid. Give it time.", "Hard to say. The Jokers are playing it cool.",
    "I've got a hunch, but I'm keeping it to myself for now.", "Everyone and no one.", "Let me watch a little longer.", "Not enough to hang anyone on.",
    "My list changes every five minutes.", "I'm stumped, and I don't like it.", "Anybody but me. That's all I know for sure.",
  ],
  answerTrust: [
    "{x}? Solid, as far as I can tell.", "I trust {x}. Mostly.", "{x} has been straight with us.", "{x} isn't the one. I'd bet on it.", "{x} seems honest. For this town, anyway.",
    "I like {x}. Don't make me regret saying that.",
  ],
  answerDistrust: [
    "{x}? Something's off there.", "{x} makes me nervous.", "I wouldn't lend {x} a dime.", "{x} is hiding something.", "Keep an eye on {x}. I am.",
    "{x}? Bad news. I can feel it.",
  ],
  banter: [
    "Anybody know if the diner's still open after this?", "The jukebox only plays one song and I hate it.", "Whose cigar is that? It smells like a tire fire.",
    "Rain, rain, and more rain. This town needs an umbrella.", "I've been at this table so long my chair knows my name.", "The ice in my drink melted an hour ago. Just like my patience.",
    "Somebody's foot is tapping. Guilty conscience?", "Is it just me or did the lights flicker?", "Mm. Good bourbon. Bad company.", "I miss the days when we just played poker.",
    "Nobody touch my hat.", "If my mother could see me now.", "The fog out there is thick enough to chew.", "That clock has been saying midnight for three hours.",
    "Who keeps humming? It's driving me crazy.", "I'd kill for a sandwich. Poor choice of words.",
  ],
  pressure: [
    "Time's running out. Somebody commit.", "We need a name before the clock does it for us.", "Tick tock, people.", "Let's not waste another day.",
    "If we skip again, somebody else dies tonight.", "Pick someone. Anyone. Well, not me.", "The Jokers love a slow day. Let's speed up.",
  ],
  readyVote: [
    "I'm ready. Let's put it to a vote.", "Enough talk. Voting time.", "I've made up my mind.", "Let's settle this.", "Ballots, please.",
    "I've heard all I need.", "Ready. Let's go.",
  ],

  // ------------------------------------------------------------ claims
  kingClaimMafia: [
    "Cards on the table: I'm the King. I checked {x}. Joker.", "I'm the Sheriff and I'm done hiding. {x} is Mafia.", "I drew the King. I looked at {x}. {x} is a Joker. Vote accordingly.",
    "Sheriff speaking. {x} is dirty. I saw it with my own eyes.", "I've been sitting on this, but no more. I'm the King, and {x} is a Joker.",
  ],
  kingClaimClean: [
    "I'm the King. I checked {x} and {x} is clean. Leave {x} alone.", "Sheriff here. {x} is town. I looked.", "King's honor: {x} is not a Joker.",
    "I'm the Sheriff. {x} came up clean. Look elsewhere.",
  ],
  kingList: ["Everything I've checked: {list}.", "For the record: {list}.", "My notebook says: {list}."],
  fakeClaim: [
    "Liar! I'm the King, and I checked {x}. Joker!", "Don't listen to {x}. I'M the Sheriff. And {x} is Mafia.", "There's only one King, and you're looking at them. {x} is lying.",
    "{x}, you picked the wrong card to fake. I'm the King.", "Funny, {x}. I'm the real Sheriff. And I checked you.",
  ],
  fakeClaimClean: ["I'm the actual King. {x} is clean, for the record.", "Real Sheriff here. I cleared {x}."],
  claimBelieve: [
    "The King speaks. I'm listening.", "I'll take the badge's word for it.", "Good. Finally, a lead.", "{x} has the crown. Follow {x}.", "That's what we needed. Thank you, {x}.",
    "I believe {x}. Nobody would lie about that this early.",
  ],
  claimDoubt: [
    "Awfully convenient, {x}.", "Could be true. Could be a Joker in a paper crown.", "I'll believe it when I see a body flip, {x}.", "Everybody's a King when the rope comes out, {x}.",
    "Prove it, {x}.", "{x} the King? I've seen better bluffs.",
  ],
  angelClaim: [
    "I'm the Ace. I protected {x} on night {n}. That's why {x} is still here.", "Angel here. Night {n}, I watched over {x}. You're welcome.",
    "I'm the Ace, and the save on night {n} was mine. {x}.",
  ],
  angelClaimPlain: ["Fine. I'm the Ace. Hang me and you lose your only shield.", "I'm the Angel. Think very hard before you vote me."],
  civClaim: [
    "I'm a {card}. Boring, I know.", "{card}. Just a number, like most of you.", "My card? {card}. Nothing to see here.", "I've got a {card}. Wish it was more exciting.",
    "Plain old {card}. No tricks.",
  ],

  // ------------------------------------------------------------ replies to the human
  replyGreet: [
    "{h}! There you are.", "Hey there, {h}.", "Evening, {h}. Nice hat.", "{h}. Always a pleasure. Mostly.", "Well, hello, {h}.", "Hiya, {h}.",
    "{h}. Keep your voice down, the walls have ears.", "Good to see you, {h}. Still alive, I see.",
  ],
  replyThanks: ["Anytime.", "You'd do the same for me. Right?", "Don't make it weird, {h}.", "Just remember it at the vote.", "You're welcome, {h}."],
  replyInsult: [
    "Ooh. Somebody's cranky.", "Nice mouth on you, {h}.", "Temper, temper, {h}. That's how Jokers slip.", "Keep it up, {h}. I'm taking notes.",
    "Sticks and stones, {h}.", "That's the Joker talking, {h}.", "Say that again when the vote's open, {h}.",
  ],
  replyLaugh: ["Something funny, {h}?", "Ha. Sure.", "Laugh it up.", "I'm glad one of us is having fun.", "Heh. Good one.", "Nervous laughter, {h}?"],
  replyAgree: ["Exactly.", "My thoughts exactly, {h}.", "See? {h} gets it.", "Right with you, {h}.", "That's the spirit."],
  replyConfused: ["What was that, {h}?", "You lost me, {h}.", "Run that by me again, {h}.", "I don't follow, {h}.", "Is that code, {h}?"],
  replyPleaBelieve: ["Okay, {h}. You seem honest.", "I believe you, {h}. Don't prove me wrong.", "Fair enough, {h}.", "I'll take your word, {h}. For today."],
  replyPleaDoubt: ["Words are cheap, {h}.", "We'll see, {h}.", "Hmm. Methinks {h} doth protest too much.", "That's exactly what I'd say if I were a Joker, {h}.", "Convince me, {h}."],
  replyHumanClaimKing: [
    "Alright, {h}, the floor's yours. Who'd you check?", "The King, eh? Let's hear your results, {h}.", "Bold claim, {h}. Back it up.", "If that's true, {h}, you're a target now. Talk fast.",
  ],
  replyHumanClaimKingDoubt: ["Wait, {h}. {x} already claimed King. One of you is a liar.", "Two Kings, {h}? That doesn't add up.", "{h}, {x} said the same thing. Who do we believe?"],
  replyHumanClaimAce: ["The Ace, huh? Then keep your wings close, {h}.", "Good to know, {h}. Now the Jokers know too.", "Hope you're telling the truth, {h}.", "An Angel at the table. Protect the right people, {h}."],
  replyHumanClaimCiv: ["Join the club, {h}.", "Number cards unite, {h}.", "Same boat, {h}.", "Plain card, plain folks. Fair enough, {h}."],
  replyHumanResultMafia: ["{x}? I knew it!", "Then it's {x}. Everybody vote {x}.", "The King has spoken. {x} goes.", "{x}! I had a feeling.", "No more debate. {x}."],
  replyHumanResultMafiaDoubt: ["Slow down, {h}. {x}? Really?", "{x}? I'm not buying it yet, {h}.", "Convenient accusation, {h}.", "Hmm. I'd like a second opinion on {x}."],
  replyHumanResultClean: ["Good. {x} is off the hook.", "{x} is clean? Okay, that narrows it down.", "One less suspect. Thanks, {h}.", "Noted, {h}. {x} is safe."],
  replySkip: ["Skip? The Jokers would love that, {h}.", "Every skip is a free kill for them, {h}.", "No skipping. Pick someone, {h}.", "We can't afford to skip, {h}."],
  replyVoteOther: ["{x}, huh? Tell me more, {h}.", "{x}? Could be. What's your reason, {h}?", "Interesting pick, {h}. {x}.", "I'll think about {x}, {h}."],
  replyVoteOtherAgree: ["You too, {h}? {x} has been off all day.", "Yes! {x}. Thank you, {h}.", "{h} and I agree. {x}.", "Now we're getting somewhere. {x}.", "Right there with you, {h}. {x}."],
  replyVoteOtherDisagree: ["{x}? Nah, {h}.", "{h}, {x} has been clean all game.", "You're looking at the wrong one, {h}.", "{x}? I don't think so, {h}.", "Wrong tree, {h}. Wrong forest."],
  replyAccusedByHuman: [
    "Whoa, whoa. Me, {h}?", "{h}, you're making a mistake.", "Why me, {h}? I've been helping!", "Take that back, {h}.", "Interesting, {h}. Very interesting.",
    "That's a bold move, {h}. Let's see if it pays off.", "You've got it all wrong, {h}.",
  ],
  replyWhyMe: ["Here's why: {reason}", "Easy. {reason}", "Because, {h}: {reason}", "Think about it. {reason}"],
  replyAskMe: ["You called, {h}?", "Yeah? What's up, {h}?", "Go ahead, {h}. I'm all ears.", "Something on your mind, {h}?", "I'm here, {h}."],

  // ------------------------------------------------------------ vote
  voteFor: [
    "Putting my vote on {x}.", "{x}. Sorry, not sorry.", "{x}. Let's see that card.", "My vote goes to {x}.", "{x}, it's been nice knowing you.", "I'm with the {x} crowd.",
    "Vote cast. {x}.", "Adios, {x}.", "{x}. Prove me wrong.",
  ],
  voteSkip: ["Skip. Not enough to go on.", "I'm not hanging anyone blind.", "Skip. I won't gamble a life on a hunch.", "Pass."],
  voteSwitch: ["Okay, I'm moving to {x}.", "Changed my mind. {x}.", "Switching. {x} makes more sense.", "Fine, {x}. You convinced me."],
  voteReactOnMe: [
    "Me? Are you all crazy?", "This is a mistake! I'm on your side!", "You're about to hang an innocent!", "Think about this! Please!", "Don't do this. You'll be sorry.",
    "Wait, wait, wait! Look at the others!",
  ],

  // ------------------------------------------------------------ last words
  lastTown: [
    "I'm a {card}. Remember that when you're choosing tomorrow.", "You got it wrong. The Jokers are still here. Find them.", "Look at who pushed for me. That's your Joker.",
    "So long, friends. Well, most of you.", "I'm innocent. And you'll know it in a minute.", "Tell my mother I was honest.", "Mark my words: you'll regret this tonight.",
  ],
  lastMafia: [
    "Well. It was fun while it lasted.", "Good work. Too bad it's too late.", "I'd tip my hat, but you're about to take it.", "You found me. Now find the rest.",
    "Heh. You'll never find my partner.", "Nice catch. Truly.", "Save me a seat in hell.",
  ],
  lastKing: ["Last chance to listen: I'm the King. {list}.", "I'm the Sheriff, you fools! {list}."],
  lastAngel: ["I'm the Ace. Good luck tonight without me.", "You're hanging your Angel. Sleep well.", "The Ace is leaving the table. Lock your doors."],

  // ------------------------------------------------------------ verdicts
  execMafia: ["Got one!", "Ha! A Joker! I knew it.", "One down. Keep going.", "Finally, some justice.", "That's how it's done.", "The rope doesn't lie."],
  execTown: ["We hanged a {card}. Somebody here should feel terrible.", "An innocent {card}. The Jokers are laughing right now.", "That was a mistake. A big one.", "We got it wrong. Again.", "A {card}. Great. Just great."],
  execTownBlame: ["{x} led us into that. Don't forget it.", "Funny how {x} was so sure. Remember that tomorrow.", "{x} pushed hardest. Food for thought.", "Next time, let's not listen to {x}."],
  noExec: ["Nobody hangs. The Jokers sleep happy tonight.", "No verdict. That's a free night for the Mafia.", "All that talk for nothing.", "Deadlock. Wonderful."],

  // ------------------------------------------------------------ end
  winTown: ["Justice! Sweet justice!", "The Jokers are finished. This town is ours.", "Good game, everybody. The good guys won.", "The sun is finally coming up.", "Nobody cheats this town. Not tonight."],
  winMafia: ["The house always wins.", "Thanks for the votes, suckers.", "Good game. We lied, you died.", "Surprise.", "Never trust a smiling face."],
  loseTown: ["Unbelievable. They fooled us all.", "Next game, I'm trusting nobody. Especially me.", "Good game, Jokers. I'll get you next time.", "Well, that's embarrassing."],
  loseMafia: ["Good game. You earned it.", "Next time I'm bringing a better poker face.", "Alright, alright. You got us.", "Rematch. Right now."],

  // ------------------------------------------------------------ the dead
  ghostChat: [
    "Being dead gives you perspective.", "They're all so wrong. It's painful to watch.", "Hey, at least nobody can vote us out anymore.", "The view from up here is something.",
    "I'd scream the answer at them if I could.", "Look at them argue. Were we that bad?", "Pass the ghost bourbon.", "I'm haunting whoever did this. Personally.",
  ],
  ghostReveal: ["Oh, it's {x}. Of course it's {x}.", "{x}! Look at {x}'s card! I knew it!", "Wait, {x}? I trusted {x}!", "{x} has been lying through their teeth the whole time."],
  ghostReply: ["Welcome to the other side, {h}.", "Hey, {h}. Pull up a cloud.", "{h}! Good to have company.", "Now you can see everything too, {h}. Isn't it awful?", "Rest easy, {h}. Watch the show."],
};

// Extra lines that only certain people say
export const MORE_PERSONA = {
  tough: {
    greet: ["Nobody tries anything funny tonight. I'm watching.", "Cards down, hands up where I can see them."],
    accuse: ["{x}, look me in the eye. Yeah, I thought so. {reason}", "I've got a list, and {x} is on top. {reason}", "Where I come from, we deal with guys like {x} fast. {reason}"],
    defendSelf: ["I've never lied in my life. Well, not tonight.", "You want a piece of me, {x}? Get in line."],
    counterAccuse: ["Big talk, {x}. Back it up or back off.", "Say that to my face, {x}. Oh wait, you just did."],
    voteFor: ["{x}. No hard feelings. Maybe a few.", "Lights out, {x}."],
    banter: ["I once held a door shut for six hours. I can sit here all night.", "Nobody's leaving until we find them."],
    lastTown: ["You're making a mistake. And I don't forgive mistakes. Well, I'm dead, so."],
    winTown: ["Told you. Nobody messes with this table."],
    mafiaChat: ["Leave the rough stuff to me.", "I'll handle the loudmouths tomorrow."],
    replyInsult: ["Say that again, {h}. Slowly.", "You got a death wish, {h}?"],
    deathReact: ["Whoever did {x}, I'm coming for you."],
  },
  sharp: {
    greet: ["I'm writing down everything you say. Just so you know.", "Numbers don't lie. People do. Let's begin."],
    accuse: ["The ledger doesn't balance, {x}. {reason}", "I've checked {x}'s numbers twice. {reason}", "{x}'s story has a missing zero. {reason}"],
    defendSelf: ["Check my votes. Every one of them was for town.", "My record speaks for itself. {card}."],
    counterAccuse: ["{x}, your math is off. And so is your story."],
    question: ["{x}, walk me through your vote yesterday. Slowly.", "Who voted first yesterday? I have it written down."],
    agree: ["{y}'s numbers add up. {x}.", "I ran the same numbers as {y}. {x}."],
    replyInsult: ["Insults are what people use when the facts run out, {h}."],
    winMafia: ["Balanced the books. In our favor."],
    execMafia: ["And the books are balanced. One Joker less."],
    mafiaChat: ["I've planned tomorrow down to the minute.", "Don't improvise tomorrow. Stick to the script."],
  },
  nervous: {
    greet: ["Oh boy. Oh boy oh boy. Here we go.", "I-I didn't even want to play tonight."],
    accuse: ["I-I don't want to say it, but... {x}. {reason}", "Please don't kill me for saying this, but {x}. {reason}"],
    defendSelf: ["I'm sweating because I'm nervous, not because I'm a Joker!", "I'm a {card}! I'm always sweaty!"],
    counterAccuse: ["W-why me, {x}? Why not you?"],
    firstDay: ["Can we all just agree not to kill me? Great. Thanks."],
    voteFor: ["S-sorry, {x}. I'm voting for you."],
    deathReact: ["They got {x}? That could've been me! That could STILL be me!"],
    banter: ["I think my chair is wobbling. Or is that me?", "Nobody look at me. I'm fine."],
    lastTown: ["I knew it! I knew I'd die tonight! I'm a {card}!"],
    replyInsult: ["Hey, that's not nice, {h}."],
    mafiaChat: ["I'm so nervous. Is it obvious? It's obvious.", "Do I look innocent? Tell me I look innocent."],
  },
  dramatic: {
    greet: ["What a night for murder, darlings.", "The stage is set, the lights are low. Let's begin."],
    accuse: ["Look at {x}, playing the innocent lamb. {reason}", "Every scene needs a villain, and {x} was born for the part. {reason}"],
    defendSelf: ["Me? A Joker? How dare you! I'm a {card}!", "I'm an artist, {x}, not a murderer."],
    counterAccuse: ["What a performance, {x}. Truly. But I'm not fooled."],
    lastTown: ["Remember me as I was. A humble {card}, betrayed by my friends."],
    lastMafia: ["What a finale! Curtain!"],
    voteFor: ["Exit, stage left, {x}."],
    banter: ["If this were an opera, someone would be singing about now.", "The rain always falls hardest on the innocent."],
    winTown: ["Bravo! Bravo! Encore!"],
    savedReact: ["A miracle! A true miracle!"],
    execTown: ["Oh, the tragedy! We hanged a {card}!"],
  },
  joker: {
    greet: ["Place your bets, folks. Who's the Joker?", "I feel lucky tonight. That's never good."],
    accuse: ["I'd bet my shirt on {x}. {reason}", "Three to one it's {x}. {reason}", "My lucky dice say {x}. {reason}"],
    defendSelf: ["Hey, I'm a gambler, not a killer. {card}, honest.", "The odds of me being a Joker? Terrible. Trust me."],
    counterAccuse: ["I'll raise you one accusation, {x}."],
    firstDay: ["Ten bucks says we get it wrong today.", "Anybody want to start a pool on the Joker?"],
    banter: ["I'd flip a coin to decide, but I lost my coin.", "Lady Luck is sitting at this table. I'm hoping next to me."],
    readyVote: ["Let's roll the dice."],
    deathReact: ["Poor {x}. Bad beat."],
    winMafia: ["Jackpot!"],
    loseTown: ["I'll get 'em next hand."],
    mafiaChat: ["Now THIS is a game.", "I've got the best poker face in town. Relax."],
  },
  grumpy: {
    greet: ["Great. Another game. Can't wait.", "Let's just get this over with."],
    accuse: ["{x}. Happy? {reason}", "I don't like {x}. I don't like anybody, but especially {x}. {reason}"],
    defendSelf: ["Oh, sure, blame the grump. I'm a {card}. Go away.", "I'm too tired to be a Joker, {x}."],
    counterAccuse: ["Yeah? Well, you're annoying, {x}. And suspicious."],
    voteFor: ["{x}. Now can we go home?", "Whatever. {x}."],
    banter: ["This chair is terrible.", "My ninth finger is itching. Somebody's lying.", "Why does it always rain on game night?"],
    deathReact: ["{x}. Well. Didn't see that coming. Actually, I did."],
    execMafia: ["Took you long enough."],
    replyGreet: ["Yeah, yeah. Hi, {h}."],
    replyLaugh: ["Hilarious, {h}. Really."],
    mafiaChat: ["Can we pick someone already? I'm tired."],
  },
  wise: {
    greet: ["Settle down, children. Let's play nice.", "I've buried three husbands and a card shark. Let's begin."],
    accuse: ["Honey, {x} is lying. I can tell. {reason}", "I've seen that look on {x} before. On a tenant who skipped rent. {reason}"],
    defendSelf: ["I'm too old to be a Joker, {x}. I'm a {card}.", "Sweetheart, if I wanted you dead, you'd know."],
    counterAccuse: ["{x}, dear, you should be more careful who you accuse."],
    firstDay: ["Let's all take a breath and listen. The liars will show themselves."],
    agree: ["{y} has good eyes. {x} it is."],
    banter: ["In my day, we settled this with pie.", "This town has seen worse. Barely."],
    deathReact: ["Poor {x}. They had a good heart. Well, a decent one."],
    winTown: ["See? A little patience goes a long way."],
    replyInsult: ["Such language, {h}. Your mother would be ashamed."],
    replyGreet: ["Hello, dear.", "There's my favorite tenant. Hello, {h}."],
    mafiaChat: ["Slow and steady, dear. Slow and steady."],
  },
  rookie: {
    greet: ["Is this how it starts? Cool. I mean, scary.", "My first game with the big leagues. Wish me luck."],
    accuse: ["Maybe {x}? I-I'm not sure. {reason}", "I don't know much, but {x} seems weird. {reason}"],
    defendSelf: ["I'm new! I'm a {card}! I don't even know how to be a Joker!", "Please, I'm just a rookie. {card}."],
    counterAccuse: ["Why would you say that, {x}? That's mean."],
    question: ["Is it normal to be this scared?", "{x}, how do you know who's lying? Teach me."],
    firstDay: ["So, uh, how do we figure out who it is?"],
    banter: ["My ma packed me a sandwich. Anybody want half?", "Do we get paid for this?"],
    deathReact: ["{x}! They were nice to me!"],
    voteFor: ["I'm voting for {x}. I think that's right?"],
    winTown: ["We won? We WON! Is that normal?"],
    mafiaChat: ["This is so exciting. Also terrifying.", "I've never done this before. Am I doing it right?"],
  },
  hothead: {
    greet: ["Somebody here's a Joker and I'm gonna find 'em!", "I'm in a mood tonight. Just saying."],
    accuse: ["{x}! Don't even try to deny it! {reason}", "I KNEW it! {x}! {reason}", "{x}, you rat! {reason}"],
    defendSelf: ["I'm a {card}! Get off my back!", "You wanna go, {x}? I'm INNOCENT!"],
    counterAccuse: ["YOU'RE the Joker, {x}! You!", "Oh, that's rich, {x}! Coming from YOU!"],
    agree: ["YES! {y}! {x}! FINALLY!"],
    voteFor: ["{x}! Bye! Good riddance!", "{x}! Hang 'em high!"],
    banter: ["Somebody's gonna get hurt tonight. Figuratively. Maybe."],
    deathReact: ["{x}?! That's IT! Somebody's getting it today!"],
    pressure: ["Pick someone or I'll pick for you!"],
    replyInsult: ["You wanna say that again, {h}?! Huh?!"],
    mafiaChat: ["Let me handle the yelling tomorrow.", "I want blood tomorrow."],
  },
  charming: {
    greet: ["Good evening, handsome people.", "What a lovely group. Shame one of you is a killer."],
    accuse: ["{x}, darling, I adore you. But {reason}", "Oh, {x}. You were doing so well. Then {reason}"],
    defendSelf: ["Me, sweetheart? I'm a {card}. And a lady never lies. Much.", "Would this face lie to you, {x}?"],
    counterAccuse: ["Oh, {x}. I expected better from you."],
    agree: ["{y} is right, darling. {x}."],
    banter: ["More wine, anyone? No? More for me.", "My late husband loved this game. Well, until he died."],
    deathReact: ["{x}... such a waste of a lovely face."],
    replyGreet: ["Hello, handsome.", "{h}, darling. So glad you're here."],
    replyInsult: ["Oh, {h}. That's no way to talk to a widow."],
    winMafia: ["Oh, darlings. You never stood a chance."],
    mafiaChat: ["Leave the charming to me.", "They adore me. It's almost too easy."],
  },
  analyst: {
    greet: ["Begin observation.", "Everyone, please behave predictably. It helps."],
    accuse: ["The data points to {x}. {reason}", "By process of elimination: {x}. {reason}", "{x}'s behavior deviates from baseline. {reason}"],
    defendSelf: ["Logically, a Joker would not draw attention to themselves like I have. {card}.", "The hypothesis that I'm a Joker is unsupported, {x}."],
    counterAccuse: ["Your accusation is statistically suspicious, {x}."],
    question: ["{x}, what is your confidence level on your top suspect?", "Let's gather data. Everyone name one suspect."],
    agree: ["{y}'s reasoning is sound. {x}.", "I concur with {y}. {x} is the likely candidate."],
    banter: ["The probability of rain tonight is one hundred percent. It's always raining.", "Fascinating. Truly fascinating."],
    deathReact: ["{x}'s death is data. Let's use it."],
    voteFor: ["My analysis says {x}."],
    execMafia: ["Hypothesis confirmed."],
    execTown: ["Hypothesis rejected. We hanged a {card}."],
    mafiaChat: ["I've calculated our odds. They're excellent."],
  },
};
