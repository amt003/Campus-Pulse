const QuestionBank = require("../models/QuestionBank");

const CURATED_QUESTIONS = [
  // ==========================================
  // QUANTITATIVE APTITUDE (30 Questions)
  // ==========================================
  {
    questionText: "What is the simple interest on Rs. 5000 at 8% per annum for 3 years?",
    options: ["Rs. 1000", "Rs. 1200", "Rs. 1400", "Rs. 1500"],
    correctOption: 1,
    difficulty: "Easy",
    category: "Quantitative",
  },
  {
    questionText: "A sum of money doubles itself in 5 years at simple interest. In how many years will it become 4 times?",
    options: ["10 years", "12 years", "15 years", "20 years"],
    correctOption: 2,
    difficulty: "Easy",
    category: "Quantitative",
  },
  {
    questionText: "If the ratio of the areas of two squares is 9:25, what is the ratio of their perimeters?",
    options: ["3:5", "9:25", "81:625", "1:2"],
    correctOption: 0,
    difficulty: "Easy",
    category: "Quantitative",
  },
  {
    questionText: "A car covers a distance of 180 km in 3 hours. What is its speed in meters per second?",
    options: ["15 m/s", "16.67 m/s", "20 m/s", "25 m/s"],
    correctOption: 1,
    difficulty: "Easy",
    category: "Quantitative",
  },
  {
    questionText: "If 12 men can complete a project in 20 days, how many days will 15 men take to complete the same work?",
    options: ["14 days", "16 days", "18 days", "15 days"],
    correctOption: 1,
    difficulty: "Easy",
    category: "Quantitative",
  },
  {
    questionText: "What is 15% of 60% of 500?",
    options: ["45", "50", "35", "40"],
    correctOption: 0,
    difficulty: "Easy",
    category: "Quantitative",
  },
  {
    questionText: "A shopkeeper sells a book for Rs. 450 incurring a loss of 10%. At what price should he sell it to gain 10%?",
    options: ["Rs. 500", "Rs. 550", "Rs. 600", "Rs. 525"],
    correctOption: 1,
    difficulty: "Medium",
    category: "Quantitative",
  },
  {
    questionText: "The average of 5 consecutive odd numbers is 27. What is the largest of these numbers?",
    options: ["29", "31", "33", "35"],
    correctOption: 1,
    difficulty: "Easy",
    category: "Quantitative",
  },
  {
    questionText: "Two pipes A and B can fill a cistern in 12 and 15 minutes respectively. If both are opened together, how long will it take to fill the tank?",
    options: ["6 minutes 40 seconds", "6 minutes", "7 minutes 30 seconds", "8 minutes"],
    correctOption: 0,
    difficulty: "Medium",
    category: "Quantitative",
  },
  {
    questionText: "A train 150 meters long is running at a speed of 54 km/h. How much time will it take to pass an electric pole?",
    options: ["10 seconds", "12 seconds", "15 seconds", "8 seconds"],
    correctOption: 0,
    difficulty: "Easy",
    category: "Quantitative",
  },
  {
    questionText: "The compound interest on Rs. 10,000 for 2 years at 10% per annum compounded annually is:",
    options: ["Rs. 2000", "Rs. 2100", "Rs. 2200", "Rs. 2050"],
    correctOption: 1,
    difficulty: "Medium",
    category: "Quantitative",
  },
  {
    questionText: "In how many ways can the letters of the word 'LEADER' be arranged?",
    options: ["720", "360", "120", "480"],
    correctOption: 1,
    difficulty: "Medium",
    category: "Quantitative",
  },
  {
    questionText: "From a pack of 52 cards, two cards are drawn at random. What is the probability that both are Kings?",
    options: ["1/221", "1/169", "1/13", "4/221"],
    correctOption: 0,
    difficulty: "Medium",
    category: "Quantitative",
  },
  {
    questionText: "The HCF and LCM of two numbers are 12 and 240 respectively. If one number is 48, what is the other?",
    options: ["60", "72", "40", "84"],
    correctOption: 0,
    difficulty: "Easy",
    category: "Quantitative",
  },
  {
    questionText: "A man rows upstream at 7 km/h and downstream at 11 km/h. What is the speed of the current?",
    options: ["2 km/h", "4 km/h", "9 km/h", "1.5 km/h"],
    correctOption: 0,
    difficulty: "Easy",
    category: "Quantitative",
  },
  {
    questionText: "The perimeter of a rectangle is 60 cm and its length is 18 cm. What is its area?",
    options: ["216 sq cm", "180 sq cm", "196 sq cm", "240 sq cm"],
    correctOption: 0,
    difficulty: "Easy",
    category: "Quantitative",
  },
  {
    questionText: "If x : y = 3 : 4, what is the value of (4x + 3y) : (5x - 2y)?",
    options: ["24 : 7", "21 : 8", "12 : 7", "18 : 5"],
    correctOption: 0,
    difficulty: "Medium",
    category: "Quantitative",
  },
  {
    questionText: "A sum invested at compound interest amounts to Rs. 4840 in 2 years and Rs. 5324 in 3 years. The rate of interest is:",
    options: ["10%", "8%", "12%", "9%"],
    correctOption: 0,
    difficulty: "Hard",
    category: "Quantitative",
  },
  {
    questionText: "A vessel contains 60 liters of milk. 6 liters are taken out and replaced with water. This process is repeated once more. How much milk is left?",
    options: ["48.6 liters", "45 liters", "50.4 liters", "52 liters"],
    correctOption: 0,
    difficulty: "Hard",
    category: "Quantitative",
  },
  {
    questionText: "Find the odd number out in the series: 3, 5, 9, 11, 15, 17, 21, 24",
    options: ["21", "24", "15", "9"],
    correctOption: 1,
    difficulty: "Easy",
    category: "Quantitative",
  },
  {
    questionText: "What is the unit digit in the product (7^95 - 3^58)?",
    options: ["0", "4", "6", "7"],
    correctOption: 1,
    difficulty: "Hard",
    category: "Quantitative",
  },
  {
    questionText: "The diagonal of a cube is 6√3 cm. What is its total surface area?",
    options: ["216 sq cm", "144 sq cm", "180 sq cm", "256 sq cm"],
    correctOption: 0,
    difficulty: "Medium",
    category: "Quantitative",
  },
  {
    questionText: "A and B start a business with investments in ratio 3:5. If total annual profit is Rs. 32000, what is A's share?",
    options: ["Rs. 12000", "Rs. 20000", "Rs. 15000", "Rs. 10000"],
    correctOption: 0,
    difficulty: "Easy",
    category: "Quantitative",
  },
  {
    questionText: "What is the remainder when 2^31 is divided by 5?",
    options: ["1", "2", "3", "4"],
    correctOption: 2,
    difficulty: "Medium",
    category: "Quantitative",
  },
  {
    questionText: "A clock is started at noon. By 10 minutes past 5, through how many degrees has the hour hand turned?",
    options: ["145°", "150°", "155°", "160°"],
    correctOption: 2,
    difficulty: "Medium",
    category: "Quantitative",
  },
  {
    questionText: "A candidate who gets 20% marks in an exam fails by 30 marks. Another who gets 32% gets 42 marks more than passing. What is the passing percentage?",
    options: ["25%", "28%", "30%", "33%"],
    correctOption: 0,
    difficulty: "Medium",
    category: "Quantitative",
  },
  {
    questionText: "Three numbers are in the ratio 1:2:3 and their HCF is 12. What are the numbers?",
    options: ["12, 24, 36", "6, 12, 18", "24, 48, 72", "12, 18, 24"],
    correctOption: 0,
    difficulty: "Easy",
    category: "Quantitative",
  },
  {
    questionText: "How many diagonals does a regular convex polygon with 10 sides (decagon) have?",
    options: ["35", "40", "45", "30"],
    correctOption: 0,
    difficulty: "Medium",
    category: "Quantitative",
  },
  {
    questionText: "If log10(2) = 0.3010, what is the number of digits in 2^50?",
    options: ["15", "16", "17", "14"],
    correctOption: 1,
    difficulty: "Hard",
    category: "Quantitative",
  },
  {
    questionText: "A man can complete a journey in 10 hours. He travels the first half at 21 km/h and the second half at 24 km/h. Find the total distance.",
    options: ["224 km", "240 km", "210 km", "230 km"],
    correctOption: 0,
    difficulty: "Hard",
    category: "Quantitative",
  },

  // ==========================================
  // LOGICAL REASONING (25 Questions)
  // ==========================================
  {
    questionText: "Look at this series: 2, 1, (1/2), (1/4), ... What number should come next?",
    options: ["1/3", "1/8", "2/8", "1/16"],
    correctOption: 1,
    difficulty: "Easy",
    category: "Logical",
  },
  {
    questionText: "Pointing to a photograph of a boy, Suresh said, 'He is the son of the only son of my mother.' How is Suresh related to that boy?",
    options: ["Brother", "Uncle", "Father", "Cousin"],
    correctOption: 2,
    difficulty: "Easy",
    category: "Logical",
  },
  {
    questionText: "In a certain code, 'MONKEY' is written as 'XDJMNL'. How is 'TIGER' written in that code?",
    options: ["QDFHS", "SDFHS", "SHFDQ", "UJHFS"],
    correctOption: 0,
    difficulty: "Medium",
    category: "Logical",
  },
  {
    questionText: "Find the missing number in the sequence: 4, 9, 25, 49, 121, ?",
    options: ["144", "169", "196", "225"],
    correctOption: 1,
    difficulty: "Medium",
    category: "Logical",
  },
  {
    questionText: "Statements: All cats are dogs. All dogs are birds. Conclusions: (I) All cats are birds. (II) All birds are cats.",
    options: ["Only I follows", "Only II follows", "Both I and II follow", "Neither follows"],
    correctOption: 0,
    difficulty: "Easy",
    category: "Logical",
  },
  {
    questionText: "One morning after sunrise, Vimal was standing facing a pole. The shadow of the pole fell exactly to his right. Which direction was he facing?",
    options: ["North", "South", "East", "West"],
    correctOption: 1,
    difficulty: "Medium",
    category: "Logical",
  },
  {
    questionText: "Find the odd one out: Copper, Silver, Gold, Platinum, Diamond.",
    options: ["Silver", "Platinum", "Diamond", "Copper"],
    correctOption: 2,
    difficulty: "Easy",
    category: "Logical",
  },
  {
    questionText: "If South-East becomes North, North-East becomes West and so on, what will West become?",
    options: ["North-East", "South-East", "North-West", "South-West"],
    correctOption: 1,
    difficulty: "Medium",
    category: "Logical",
  },
  {
    questionText: "Look at this series: 7, 10, 8, 11, 9, 12, ... What number should come next?",
    options: ["10", "12", "13", "14"],
    correctOption: 0,
    difficulty: "Easy",
    category: "Logical",
  },
  {
    questionText: "Cup is to coffee as bowl is to:",
    options: ["Dish", "Soup", "Spoon", "Food"],
    correctOption: 1,
    difficulty: "Easy",
    category: "Logical",
  },
  {
    questionText: "In a row of boys, Deepak is 7th from left and Madhu is 12th from right. If they interchange positions, Deepak becomes 22nd from left. Total boys in the row are:",
    options: ["31", "33", "34", "35"],
    correctOption: 1,
    difficulty: "Medium",
    category: "Logical",
  },
  {
    questionText: "If P denotes +, Q denotes -, R denotes ×, and S denotes ÷, what is the value of: 18 R 12 S 4 Q 8 P 10?",
    options: ["56", "54", "48", "60"],
    correctOption: 0,
    difficulty: "Easy",
    category: "Logical",
  },
  {
    questionText: "Which word does NOT belong with the others?",
    options: ["Tyre", "Steering wheel", "Engine", "Car"],
    correctOption: 3,
    difficulty: "Easy",
    category: "Logical",
  },
  {
    questionText: "A is father of C and D is son of B. E is brother of A. If C is sister of D, how is B related to E?",
    options: ["Daughter", "Sister-in-law", "Mother", "Sister"],
    correctOption: 1,
    difficulty: "Hard",
    category: "Logical",
  },
  {
    questionText: "Find the next term in the alphanumeric series: C4X, F9U, I16R, ?",
    options: ["K25P", "L25O", "L27P", "M25O"],
    correctOption: 1,
    difficulty: "Medium",
    category: "Logical",
  },
  {
    questionText: "Statement: Should higher education in engineering be made completely free in India? Arguments: (I) Yes, it will improve youth skills. (II) No, it will strain national budget.",
    options: ["Only argument I is strong", "Only argument II is strong", "Both are strong", "Neither is strong"],
    correctOption: 2,
    difficulty: "Hard",
    category: "Logical",
  },
  {
    questionText: "If '+' means '×', '-' means '÷', '×' means '+', and '÷' means '-', then what is 16 + 5 - 10 × 4 ÷ 3?",
    options: ["9", "12", "15", "10"],
    correctOption: 0,
    difficulty: "Easy",
    category: "Logical",
  },
  {
    questionText: "Five people A, B, C, D, and E are seated in a row facing North. C is sitting between A and E. B is at the extreme right. Who is sitting on the immediate left of D?",
    options: ["A", "B", "C", "E"],
    correctOption: 3,
    difficulty: "Medium",
    category: "Logical",
  },
  {
    questionText: "What day of the week was 15th August 1947?",
    options: ["Thursday", "Friday", "Saturday", "Sunday"],
    correctOption: 1,
    difficulty: "Hard",
    category: "Logical",
  },
  {
    questionText: "Choose the alternative which closely resembles the mirror image of 'EFFECTIVE':",
    options: ["EVITCEFFE (reversed)", "EFFECTIVE", "EVITCEFFE", "FEEVITCEF"],
    correctOption: 0,
    difficulty: "Medium",
    category: "Logical",
  },
  {
    questionText: "If 'GIVE' is coded as '5137' and 'BAT' is coded as '924', how will 'GATE' be coded?",
    options: ["5247", "5243", "5274", "5427"],
    correctOption: 0,
    difficulty: "Easy",
    category: "Logical",
  },
  {
    questionText: "Choose the pair that has the same relationship as 'OASIS : DESERT':",
    options: ["Island : Ocean", "Forest : Tree", "Mountain : Peak", "River : Bank"],
    correctOption: 0,
    difficulty: "Medium",
    category: "Logical",
  },
  {
    questionText: "A clock gains 5 seconds in 3 minutes and was set right at 8 AM. What time will it show at 10 PM on the same day?",
    options: ["10:23:20 PM", "10:15:00 PM", "10:20:00 PM", "10:25:00 PM"],
    correctOption: 0,
    difficulty: "Hard",
    category: "Logical",
  },
  {
    questionText: "Look at this series: F2, __, D8, C16, B32. What number fills the blank?",
    options: ["E4", "E3", "F4", "D4"],
    correctOption: 0,
    difficulty: "Easy",
    category: "Logical",
  },
  {
    questionText: "If Tuesday falls on the 4th of a month, which day will fall three days after the 24th of the same month?",
    options: ["Tuesday", "Wednesday", "Thursday", "Friday"],
    correctOption: 2,
    difficulty: "Medium",
    category: "Logical",
  },

  // ==========================================
  // VERBAL ABILITY (25 Questions)
  // ==========================================
  {
    questionText: "Select the synonym of 'CANDID':",
    options: ["Frank", "Deceptive", "Arrogant", "Timid"],
    correctOption: 0,
    difficulty: "Easy",
    category: "Verbal",
  },
  {
    questionText: "Select the antonym of 'OBSOLETE':",
    options: ["Modern", "Ancient", "Outdated", "Defunct"],
    correctOption: 0,
    difficulty: "Easy",
    category: "Verbal",
  },
  {
    questionText: "Choose the correctly spelled word:",
    options: ["Bureaucracy", "Beurocracy", "Bureaucrasy", "Burocracy"],
    correctOption: 0,
    difficulty: "Medium",
    category: "Verbal",
  },
  {
    questionText: "Choose the appropriate idiom: 'He was caught _____ during the audit.'",
    options: ["red-handed", "blue-blooded", "green-thumbed", "black-and-blue"],
    correctOption: 0,
    difficulty: "Easy",
    category: "Verbal",
  },
  {
    questionText: "Select the correct preposition: 'The company is committed _____ reducing its carbon footprint.'",
    options: ["for", "to", "at", "in"],
    correctOption: 1,
    difficulty: "Easy",
    category: "Verbal",
  },
  {
    questionText: "Find the part with grammatical error: (A) One of the players / (B) have forgotten / (C) their kit bag / (D) in the bus.",
    options: ["A", "B", "C", "D"],
    correctOption: 1,
    difficulty: "Medium",
    category: "Verbal",
  },
  {
    questionText: "Substitute one word: 'A person who cannot be corrected or reformed.'",
    options: ["Incorrigible", "Invulnerable", "Infallible", "Incurable"],
    correctOption: 0,
    difficulty: "Medium",
    category: "Verbal",
  },
  {
    questionText: "Select the antonym of 'UBIQUITOUS':",
    options: ["Omnipresent", "Rare", "Pervasive", "Global"],
    correctOption: 1,
    difficulty: "Hard",
    category: "Verbal",
  },
  {
    questionText: "Complete the sentence: 'Neither the teacher nor the students _____ ready for the surprise inspection.'",
    options: ["was", "were", "is", "be"],
    correctOption: 1,
    difficulty: "Medium",
    category: "Verbal",
  },
  {
    questionText: "Identify the meaning of the idiom: 'To burn the candle at both ends.'",
    options: ["To waste money", "To overwork yourself", "To celebrate lavishly", "To live in darkness"],
    correctOption: 1,
    difficulty: "Easy",
    category: "Verbal",
  },
  {
    questionText: "Select the synonym of 'METICULOUS':",
    options: ["Punctilious", "Careless", "Rapid", "Indifferent"],
    correctOption: 0,
    difficulty: "Medium",
    category: "Verbal",
  },
  {
    questionText: "Choose the correctly spelled word:",
    options: ["Privilege", "Privelege", "Priviledge", "Privilige"],
    correctOption: 0,
    difficulty: "Easy",
    category: "Verbal",
  },
  {
    questionText: "Change to passive voice: 'The chef prepared a delectable dessert.'",
    options: [
      "A delectable dessert was prepared by the chef.",
      "A delectable dessert is prepared by the chef.",
      "A delectable dessert had been prepared by the chef.",
      "A delectable dessert has prepared the chef.",
    ],
    correctOption: 0,
    difficulty: "Easy",
    category: "Verbal",
  },
  {
    questionText: "Substitute one word: 'Fear of closed or confined spaces.'",
    options: ["Acrophobia", "Claustrophobia", "Agoraphobia", "Hydrophobia"],
    correctOption: 1,
    difficulty: "Easy",
    category: "Verbal",
  },
  {
    questionText: "Fill in the blank: 'Scarcely had she stepped out _____ it began to rain heavily.'",
    options: ["than", "when", "then", "while"],
    correctOption: 1,
    difficulty: "Medium",
    category: "Verbal",
  },
  {
    questionText: "Select the synonym of 'PRAGMATIC':",
    options: ["Theoretical", "Practical", "Idealistic", "Vague"],
    correctOption: 1,
    difficulty: "Medium",
    category: "Verbal",
  },
  {
    questionText: "Select the antonym of 'EPHEMERAL':",
    options: ["Permanent", "Transitory", "Fleet", "Brief"],
    correctOption: 0,
    difficulty: "Hard",
    category: "Verbal",
  },
  {
    questionText: "Choose the word with correct spelling:",
    options: ["Millennium", "Millenium", "Milennium", "Milenium"],
    correctOption: 0,
    difficulty: "Medium",
    category: "Verbal",
  },
  {
    questionText: "Identify the correct indirect speech: He said, 'I have completed my assignment.'",
    options: [
      "He said that he had completed his assignment.",
      "He said that he completed his assignment.",
      "He said that he has completed his assignment.",
      "He said he will complete his assignment.",
    ],
    correctOption: 0,
    difficulty: "Easy",
    category: "Verbal",
  },
  {
    questionText: "What is the meaning of 'Bite the bullet'?",
    options: ["To face a grim situation with courage", "To get into a fight", "To injure oneself accidentally", "To eat quickly"],
    correctOption: 0,
    difficulty: "Easy",
    category: "Verbal",
  },
  {
    questionText: "Choose the correct collective noun: A _____ of lions rested under the baobab tree.",
    options: ["pack", "pride", "herd", "colony"],
    correctOption: 1,
    difficulty: "Easy",
    category: "Verbal",
  },
  {
    questionText: "Substitute one word: 'An author's unpublished handwritten manuscript or work.'",
    options: ["Inscription", "Manuscript", "Scroll", "Calligraphy"],
    correctOption: 1,
    difficulty: "Easy",
    category: "Verbal",
  },
  {
    questionText: "Select the antonym of 'ALACRITY':",
    options: ["Hesitation", "Eagerness", "Promptness", "Swiftness"],
    correctOption: 0,
    difficulty: "Hard",
    category: "Verbal",
  },
  {
    questionText: "Choose the grammatically correct sentence:",
    options: [
      "She sings better than anyone in her class.",
      "She sings more better than anyone in her class.",
      "She sings best than anyone in her class.",
      "She sing better than anyone in her class.",
    ],
    correctOption: 0,
    difficulty: "Easy",
    category: "Verbal",
  },
  {
    questionText: "Fill in the blank: 'If I _____ you, I would accept the job offer immediately.'",
    options: ["was", "were", "am", "have been"],
    correctOption: 1,
    difficulty: "Medium",
    category: "Verbal",
  },

  // ==========================================
  // TECHNICAL FUNDAMENTALS (20 Questions)
  // ==========================================
  {
    questionText: "What is the average time complexity of searching an element in a Hash Table with good hash distribution?",
    options: ["O(1)", "O(log N)", "O(N)", "O(N log N)"],
    correctOption: 0,
    difficulty: "Easy",
    category: "Technical",
  },
  {
    questionText: "Which normal form removes transitive dependencies in relational database management systems?",
    options: ["1NF", "2NF", "3NF", "BCNF"],
    correctOption: 2,
    difficulty: "Easy",
    category: "Technical",
  },
  {
    questionText: "Which of the following data structures operates on a Last-In, First-Out (LIFO) basis?",
    options: ["Queue", "Stack", "Binary Search Tree", "Linked List"],
    correctOption: 1,
    difficulty: "Easy",
    category: "Technical",
  },
  {
    questionText: "In JavaScript, what does `typeof null` return?",
    options: ["'null'", "'undefined'", "'object'", "'boolean'"],
    correctOption: 2,
    difficulty: "Easy",
    category: "Technical",
  },
  {
    questionText: "Which sorting algorithm has a worst-case time complexity of O(N log N)?",
    options: ["Merge Sort", "Quick Sort", "Bubble Sort", "Insertion Sort"],
    correctOption: 0,
    difficulty: "Medium",
    category: "Technical",
  },
  {
    questionText: "What does the ACID acronym stand for in database transactions?",
    options: [
      "Atomicity, Consistency, Isolation, Durability",
      "Accuracy, Completeness, Integrity, Durability",
      "Atomicity, Concurrency, Isolation, Dependability",
      "Availability, Consistency, Integrity, Durability",
    ],
    correctOption: 0,
    difficulty: "Easy",
    category: "Technical",
  },
  {
    questionText: "Which HTTP status code indicates 'Unauthorized' access?",
    options: ["400", "401", "403", "404"],
    correctOption: 1,
    difficulty: "Easy",
    category: "Technical",
  },
  {
    questionText: "What is the primary purpose of an index in a database?",
    options: [
      "To optimize data retrieval speed",
      "To encrypt data at rest",
      "To enforce database constraints only",
      "To compress tables on disk",
    ],
    correctOption: 0,
    difficulty: "Easy",
    category: "Technical",
  },
  {
    questionText: "Which transport layer protocol provides reliable, connection-oriented data transmission?",
    options: ["UDP", "TCP", "ICMP", "IP"],
    correctOption: 1,
    difficulty: "Easy",
    category: "Technical",
  },
  {
    questionText: "What is the worst-case time complexity of binary search on a sorted array of size N?",
    options: ["O(1)", "O(log N)", "O(N)", "O(N^2)"],
    correctOption: 1,
    difficulty: "Easy",
    category: "Technical",
  },
  {
    questionText: "Which OOP principle involves hiding internal implementation details and exposing only essential interfaces?",
    options: ["Encapsulation", "Polymorphism", "Inheritance", "Abstraction"],
    correctOption: 3,
    difficulty: "Medium",
    category: "Technical",
  },
  {
    questionText: "In operating systems, which condition is NOT one of Coffman's four conditions for deadlock?",
    options: ["Mutual Exclusion", "Hold and Wait", "Preemption", "Circular Wait"],
    correctOption: 2,
    difficulty: "Hard",
    category: "Technical",
  },
  {
    questionText: "What is the output of `0.1 + 0.2 === 0.3` in standard IEEE 754 floating point arithmetic (e.g. JavaScript)?",
    options: ["true", "false", "undefined", "NaN"],
    correctOption: 1,
    difficulty: "Medium",
    category: "Technical",
  },
  {
    questionText: "Which graph traversal algorithm uses a Queue data structure?",
    options: ["Breadth-First Search (BFS)", "Depth-First Search (DFS)", "Dijkstra's Algorithm", "Topological Sort"],
    correctOption: 0,
    difficulty: "Easy",
    category: "Technical",
  },
  {
    questionText: "In git, which command is used to combine changes from another branch into the current active branch?",
    options: ["git checkout", "git merge", "git fetch", "git push"],
    correctOption: 1,
    difficulty: "Easy",
    category: "Technical",
  },
  {
    questionText: "What is the space complexity of Depth First Search (DFS) on a tree of height H?",
    options: ["O(1)", "O(H)", "O(N^2)", "O(log H)"],
    correctOption: 1,
    difficulty: "Medium",
    category: "Technical",
  },
  {
    questionText: "What does the CAP theorem state regarding distributed systems?",
    options: [
      "A distributed system can only provide two of Consistency, Availability, and Partition Tolerance simultaneously.",
      "Distributed systems must always prioritize performance over reliability.",
      "Concurrency, Atomicity, and Performance are mutually exclusive.",
      "Cluster nodes cannot scale horizontally beyond physical storage limits.",
    ],
    correctOption: 0,
    difficulty: "Hard",
    category: "Technical",
  },
  {
    questionText: "Which SQL clause is used to filter records resulting from an aggregate function?",
    options: ["WHERE", "HAVING", "GROUP BY", "ORDER BY"],
    correctOption: 1,
    difficulty: "Medium",
    category: "Technical",
  },
  {
    questionText: "In Node.js, which thread handles the execution of non-blocking JavaScript code?",
    options: ["Libuv Worker Pool", "Single Event Loop Thread", "OS Kernel Thread", "Multi-thread V8 worker"],
    correctOption: 1,
    difficulty: "Medium",
    category: "Technical",
  },
  {
    questionText: "What is the difference between a process and a thread in modern operating systems?",
    options: [
      "A process has its own address space, whereas threads of the same process share address space.",
      "Threads have separate memory spaces, while processes share heap memory.",
      "A thread can have multiple child processes.",
      "Processes cannot be scheduled by the OS kernel.",
    ],
    correctOption: 0,
    difficulty: "Medium",
    category: "Technical",
  },
];

/**
 * Seeds pre-vetted curated questions into QuestionBank if fewer than 10 exist.
 * Designed to be idempotent and non-blocking.
 */
const seedCuratedQuestions = async () => {
  try {
    const existingCount = await QuestionBank.countDocuments({
      recruiterId: null,
      source: "curated",
    });

    if (existingCount >= 10) {
      console.log(
        `[SeedCurated] Curated question bank already populated (${existingCount} questions present). Skipping seed.`
      );
      return;
    }

    console.log(
      `[SeedCurated] Seeding ${CURATED_QUESTIONS.length} curated questions into QuestionBank...`
    );

    const questionsToInsert = CURATED_QUESTIONS.map((q) => ({
      ...q,
      recruiterId: null,
      source: "curated",
      status: "approved",
      timesUsed: 0,
      createdAt: new Date(),
    }));

    await QuestionBank.insertMany(questionsToInsert);
    console.log(`[SeedCurated] Successfully seeded ${questionsToInsert.length} curated questions.`);
  } catch (error) {
    console.error("[SeedCurated] Non-blocking warning: Failed to seed curated questions:", error.message);
  }
};

module.exports = {
  seedCuratedQuestions,
  CURATED_QUESTIONS,
};
