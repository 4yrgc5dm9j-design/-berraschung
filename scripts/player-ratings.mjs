// Ungefähre Stärkewerte, angelehnt an EA-FC-Ratings (gerundet, manuell gepflegt).
// Nicht offiziell und nicht automatisch aktuell – bei Bedarf hier anpassen.
// Format: [Name, Position (TW/AB/MF/ST), Wert]
// Spieler, die nicht in den Wikidata-Kadern auftauchen, werden ignoriert –
// außer sie stehen in ALWAYS (fester Kaderplatz).

export const RATINGS = [
  // FC Bayern München
  ['Harry Kane', 'ST', 90], ['Jamal Musiala', 'MF', 87], ['Joshua Kimmich', 'MF', 87], ['Manuel Neuer', 'TW', 86], ['Michael Olise', 'ST', 86],
  ['Luis Díaz', 'ST', 86], ['Dayot Upamecano', 'AB', 84], ['Jonathan Tah', 'AB', 84], ['Alphonso Davies', 'AB', 83], ['Kim Min-jae', 'AB', 83],
  ['Min-jae Kim', 'AB', 83], ['Serge Gnabry', 'ST', 81], ['Konrad Laimer', 'MF', 81], ['Aleksandar Pavlović', 'MF', 81], ['Leon Goretzka', 'MF', 81],
  ['Raphaël Guerreiro', 'AB', 80], ['Nicolas Jackson', 'ST', 79], ['Josip Stanišić', 'AB', 79], ['Hiroki Itō', 'AB', 78], ['Sacha Boey', 'AB', 76],
  ['Tom Bischof', 'MF', 74], ['Jonas Urbig', 'TW', 74], ['Lennart Karl', 'MF', 70],
  // Borussia Dortmund
  ['Gregor Kobel', 'TW', 86], ['Serhou Guirassy', 'ST', 85], ['Nico Schlotterbeck', 'AB', 84], ['Julian Brandt', 'MF', 82], ['Waldemar Anton', 'AB', 81],
  ['Karim Adeyemi', 'ST', 80], ['Marcel Sabitzer', 'MF', 80], ['Pascal Groß', 'MF', 80], ['Felix Nmecha', 'MF', 79], ['Julian Ryerson', 'AB', 79],
  ['Niklas Süle', 'AB', 79], ['Maximilian Beier', 'ST', 78], ['Emre Can', 'MF', 78], ['Ramy Bensebaini', 'AB', 78], ['Yan Couto', 'AB', 77],
  ['Daniel Svensson', 'AB', 76], ['Jobe Bellingham', 'MF', 75], ['Carney Chukwuemeka', 'MF', 74],
  // Bayer 04 Leverkusen
  ['Alejandro Grimaldo', 'AB', 84], ['Patrik Schick', 'ST', 82], ['Exequiel Palacios', 'MF', 82], ['Edmond Tapsoba', 'AB', 81], ['Robert Andrich', 'MF', 80],
  ['Loïc Badé', 'AB', 80], ['Aleix García', 'MF', 80], ['Mark Flekken', 'TW', 80], ['Martin Terrier', 'ST', 79], ['Jarell Quansah', 'AB', 78],
  ['Malik Tillman', 'MF', 78], ['Nathan Tella', 'ST', 76], ['Ernest Poku', 'ST', 75], ['Ibrahim Maza', 'MF', 73],
  // RB Leipzig
  ['Willi Orbán', 'AB', 81], ['Xaver Schlager', 'MF', 81], ['David Raum', 'AB', 80], ['Castello Lukeba', 'AB', 80], ['Christoph Baumgartner', 'MF', 80],
  ['Péter Gulácsi', 'TW', 80], ['Ridle Baku', 'AB', 78], ['Lutsharel Geertruida', 'AB', 77], ['Antonio Nusa', 'ST', 77], ['Kevin Kampl', 'MF', 76],
  ['Assan Ouédraogo', 'MF', 74], ['Rômulo', 'ST', 74], ['Yan Diomande', 'ST', 73],
  // VfB Stuttgart
  ['Deniz Undav', 'ST', 81], ['Angelo Stiller', 'MF', 81], ['Alexander Nübel', 'TW', 81], ['Maximilian Mittelstädt', 'AB', 79], ['Ermedin Demirović', 'ST', 79],
  ['Chris Führich', 'ST', 78], ['Atakan Karazor', 'MF', 77], ['Jeff Chabot', 'AB', 77], ['Jamie Leweling', 'ST', 77], ['Bilal El Khannouss', 'MF', 77],
  ['Josha Vagnoman', 'AB', 74],
  // Eintracht Frankfurt
  ['Kevin Trapp', 'TW', 80], ['Robin Koch', 'AB', 80], ['Ritsu Dōan', 'ST', 79], ['Ellyes Skhiri', 'MF', 79], ['Arthur Theate', 'AB', 79],
  ['Jonathan Burkardt', 'ST', 79], ['Hugo Larsson', 'MF', 78], ['Rasmus Kristensen', 'AB', 78], ['Mario Götze', 'MF', 77], ['Fares Chaïbi', 'MF', 76],
  ['Ansgar Knauff', 'ST', 76], ['Can Uzun', 'MF', 76], ['Nathaniel Brown', 'AB', 75],
  // SC Freiburg
  ['Vincenzo Grifo', 'ST', 79], ['Matthias Ginter', 'AB', 79], ['Noah Atubolu', 'TW', 78], ['Philipp Lienhart', 'AB', 78], ['Maximilian Eggestein', 'MF', 77],
  ['Christian Günter', 'AB', 76], ['Lucas Höler', 'ST', 75], ['Junior Adamu', 'ST', 74], ['Johan Manzambi', 'MF', 73],
  // VfL Wolfsburg
  ['Kamil Grabara', 'TW', 79], ['Maximilian Arnold', 'MF', 79], ['Mohamed Amoura', 'ST', 79], ['Joakim Mæhle', 'AB', 77], ['Mattias Svanberg', 'MF', 77],
  ['Denis Vavro', 'AB', 77], ['Patrick Wimmer', 'ST', 76], ['Konstantinos Koulierakis', 'AB', 76], ['Yannick Gerhardt', 'MF', 75],
  // Borussia Mönchengladbach
  ['Tim Kleindienst', 'ST', 79], ['Ko Itakura', 'AB', 78], ['Nico Elvedi', 'AB', 78], ['Franck Honorat', 'ST', 77], ['Julian Weigl', 'MF', 77],
  ['Rocco Reitz', 'MF', 76], ['Moritz Nicolas', 'TW', 76], ['Joe Scally', 'AB', 75], ['Haris Tabaković', 'ST', 75],
  // Werder Bremen
  ['Mitchell Weiser', 'AB', 78], ['Marco Friedl', 'AB', 77], ['Jens Stage', 'MF', 77], ['Romano Schmid', 'MF', 77], ['Senne Lynen', 'MF', 76],
  ['Michael Zetterer', 'TW', 75], ['Marco Grüll', 'ST', 75], ['Justin Njinmah', 'ST', 74], ['Leonardo Bittencourt', 'MF', 74],
  // 1. FSV Mainz 05
  ['Nadiem Amiri', 'MF', 79], ['Kaishu Sano', 'MF', 77], ['Lee Jae-sung', 'MF', 76], ['Robin Zentner', 'TW', 75], ['Paul Nebel', 'MF', 75],
  ['Dominik Kohr', 'AB', 75], ['Stefan Bell', 'AB', 75], ['Danny da Costa', 'AB', 74], ['Phillipp Mwene', 'AB', 74],
  // TSG Hoffenheim
  ['Oliver Baumann', 'TW', 79], ['Andrej Kramarić', 'ST', 79], ['Anton Stach', 'MF', 77], ['Grischa Prömel', 'MF', 76], ['Fisnik Asllani', 'ST', 74],
  ['Bazoumana Touré', 'ST', 74],
  // FC Augsburg
  ['Finn Dahmen', 'TW', 76], ['Alexis Claude-Maurice', 'MF', 76], ['Jeffrey Gouweleeuw', 'AB', 75], ['Kristijan Jakić', 'MF', 75], ['Marius Wolf', 'AB', 75],
  ['Chrislain Matsima', 'AB', 75],
  // 1. FC Union Berlin
  ['Frederik Rønnow', 'TW', 78], ['Danilho Doekhi', 'AB', 77], ['Diogo Leite', 'AB', 77], ['Leopold Querfeld', 'AB', 76], ['Rani Khedira', 'MF', 75],
  ['Christopher Trimmel', 'AB', 74], ['Andrej Ilić', 'ST', 73],
  // 1. FC Heidenheim
  ['Kevin Müller', 'TW', 74], ['Patrick Mainka', 'AB', 74], ['Jan Schöppner', 'MF', 72], ['Budu Zivzivadze', 'ST', 72], ['Marvin Pieringer', 'ST', 72],
  // FC St. Pauli
  ['Nikola Vasilj', 'TW', 77], ['Eric Smith', 'AB', 76], ['Jackson Irvine', 'MF', 75], ['Hauke Wahl', 'AB', 75], ['Morgan Guilavogui', 'ST', 72],
  // 1. FC Köln
  ['Marvin Schwäbe', 'TW', 74], ['Timo Hübers', 'AB', 74], ['Eric Martel', 'MF', 74], ['Linton Maina', 'ST', 74], ['Luca Waldschmidt', 'ST', 74],
  ['Ragnar Ache', 'ST', 73], ['Said El Mala', 'ST', 73], ['Jan Thielmann', 'MF', 72],
  // Hamburger SV
  ['Fábio Vieira', 'MF', 77], ['Albert Sambi Lokonga', 'MF', 76], ['Daniel Heuer Fernandes', 'TW', 75], ['Mario Vušković', 'AB', 75], ['Yussuf Poulsen', 'ST', 75],
  ['Jean-Luc Dompé', 'ST', 75], ['Luka Vušković', 'AB', 74], ['Ransford Königsdörffer', 'ST', 74], ['Jonas Meffert', 'MF', 74], ['Miro Muheim', 'AB', 74],
  ['Jordan Torunarigha', 'AB', 74], ['Warmed Omari', 'AB', 74], ['Nicolás Capaldo', 'MF', 74], ['Robert Glatzel', 'ST', 74], ['Daniel Elfadli', 'MF', 73],
  ['Ludovit Reis', 'MF', 73], ['Nicolai Remberg', 'MF', 72], ['Rayan Philippe', 'ST', 72], ['Immanuel Pherai', 'MF', 72], ['Bakéry Jatta', 'ST', 72],
  ['Giorgi Gocholeishvili', 'AB', 71], ['William Mikelbrencis', 'AB', 70],
]

/** Spieler, die auf jeden Fall im Kader stehen sollen (Wunsch des Nutzers). */
export const ALWAYS = {
  'Hamburger SV': [{ name: 'Mario Vušković', pos: 'AB', born: 2001 }],
}
