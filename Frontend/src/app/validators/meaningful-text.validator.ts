import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const meaningfulTextValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value;
  if (value === null || value === undefined || value === '') {
    return null; // Leave empty checks to Validators.required
  }

  const s = String(value).trim();
  if (!s) return null;

  // 1. Must have at least 2 alphabetic characters
  const alphaMatches = s.match(/[a-zA-Z]/g);
  if (!alphaMatches || alphaMatches.length < 2) {
    return { tooFewLetters: true };
  }

  // Split words by whitespace, dashes, slashes, and common punctuation
  const words = s.split(/[\s\-\/\,\:\;\(\)\[\]\.\!\?\"\']+/);

  // 2. Block single words of 4+ letters with 0 vowels
  // Note: Skip ALL-CAPS acronyms (e.g., 'HTML', 'HTTPS', 'DBMS', 'SMTP', 'WSDL', 'SCSS', 'FCFS', 'SJF', 'TCS')
  for (const w of words) {
    const cleanWord = w.replace(/[^a-zA-Z]/g, '');
    const isAllCapsAcronym = cleanWord.length >= 2 && cleanWord.length <= 6 && cleanWord === cleanWord.toUpperCase();
    if (cleanWord.length >= 4 && !isAllCapsAcronym && !/[aeiouyAEIOUY]/.test(cleanWord)) {
      return { noVowel: true };
    }
  }

  // 3. Block 5+ consecutive consonants in any word (keyboard mash like 'asdfghjkl' -> 'sdfghjkl')
  // Note: 'y'/'Y' is treated as vowel-like, and valid English words like 'Abstract' or 'Analyst' have up to 4 consecutive consonants/sounds (b-s-t-r, l-y-s-t)
  for (const w of words) {
    const cleanWord = w.replace(/[^a-zA-Z]/g, '');
    if (/[bcdfghjklmnpqrstvwxzBCDFGHJKLMNPQRSTVWXZ]{5,}/.test(cleanWord)) {
      return { keyboardMash: true };
    }
  }

  // 4. Block QWERTY keyboard mash patterns
  const mashPatterns = [/qwerty/i, /asdf/i, /dfgh/i, /fghj/i, /hjkl/i, /zxcv/i, /xcvb/i, /cvbn/i, /vbnm/i, /wery/i, /sdfg/i];
  for (const pat of mashPatterns) {
    if (pat.test(s)) {
      return { keyboardMash: true };
    }
  }

  // 5. Block repeating letter characters or patterns within words (e.g. 'aaaa', 'hkhkhk', 'abcabcabc')
  // Note: Ignore non-letters like spaces, newlines (\n\n\n), dashes (---), dots (...), and valid words like 'IEEE'
  for (const w of words) {
    const cleanWord = w.replace(/[^a-zA-Z]/g, '');
    if (!cleanWord) continue;
    const has4LetterRepeat = /([a-zA-Z])\1{3,}/i.test(cleanWord);
    const has2CharSeqRepeat = /([a-zA-Z]{2})\1{2,}/i.test(cleanWord);
    const has3CharSeqRepeat = /([a-zA-Z]{3})\1{2,}/i.test(cleanWord);
    if (has4LetterRepeat || has2CharSeqRepeat || has3CharSeqRepeat) {
      return { repeatingChars: true };
    }
  }

  // 6. Overall Vowel Density check for words 6+ letters (less than 15% vowels is mash, skip ALL-CAPS acronyms)
  for (const w of words) {
    const cleanWord = w.replace(/[^a-zA-Z]/g, '');
    const isAllCapsAcronym = cleanWord.length <= 6 && cleanWord === cleanWord.toUpperCase();
    if (cleanWord.length >= 6 && !isAllCapsAcronym) {
      const vowels = (cleanWord.match(/[aeiouyAEIOUY]/g) || []).length;
      if (vowels / cleanWord.length < 0.15) {
        return { noVowel: true };
      }
    }
  }

  return null;
};
