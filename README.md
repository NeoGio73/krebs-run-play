# The Krebs Run

A citric acid cycle review game for undergraduate biochemistry, and the sequel to The Battle of Embden. Students fly the Millennium Falcon from the forest moon to the station and around the cycle: the pyruvate dehydrogenase complex, three laps of the eight steps (flown through gates, with a tractor beam, and from the gun turret against TIE fighters), an escape from the Death Star, and the ATP count. Questions follow Lehninger, Principles of Biochemistry, 8th edition.

**Play:** https://neogio73.github.io/krebs-run-play/
**The game before it:** https://neogio73.github.io/battle-of-embden-play/

This repository holds only the finished web build that the site serves: the game (`index.html`, `Build/`), its page scripts, and the course announcement banner (`banner.html`, with light copies of the models and the trench's plating stored scrambled in `*.bin`). It runs in the browser on a computer, and nothing is sent anywhere: progress is saved in the student's own browser. When a student arrives from The Battle of Embden (`?from=embden`), the opening reads, without changing anything, whether Embden was finished in this browser and the name its certificate was made for (`embden-handoff.js`).

After the last gate the Falcon jumps to hyperspace. A student who cleared all 58 gates in one visit can then download a completion certificate for the course's extra credit: a PNG picture with a verification code, drawn in the browser (`certificate.js`). The name box starts with the name from the student's Embden certificate, when there is one in this browser.

## Credits

The Millennium Falcon, Death Star, TIE fighter and X-wing models were supplied by the course author; the Death Star's, TIE fighter's and X-wing's downloads did not record an author or licence. The Imperial-class Star Destroyer is "Star Wars; Imperial-Class Star Destroyer" by Heataker (Sketchfab, Sketchfab Standard licence), supplied by the course author. The gun turret's inside was drawn for this game; planets, asteroids, the Death Star's trench (plated with the Death Star model's own maps) and the effects are drawn in code. Sound is synthesized in the game; there is no recorded film audio or music. The Inter typeface is used under the SIL Open Font License. The banner uses three.js (MIT licence).

This is an unofficial fan learning game. Star Wars names and designs belong to their respective rights holders; the game is not affiliated with Lucasfilm or Disney.
