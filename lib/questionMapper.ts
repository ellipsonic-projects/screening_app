// lib/questionMapper.ts
import { canonicalizeCategory, isEligibilityCategory, isPersonalityCategory, SUPPORTED_DISPLAY_LABELS } from '@/lib/categories';

export function mapQuestionPayload(rawData: any, rowIndex?: number) {
  // Raw data from either the Excel importer or the Create Question Wizard state
  const rawType = String(rawData.type || rawData['Question Type'] || '').trim().toLowerCase();
  const rawSection = String(rawData.section || rawData['Section'] || '').trim();
  
  // 1. Map to strict DB types
  let type = rawType;
  if (['yes_no', 'coding_mcq'].includes(rawType)) {
    type = 'mcq';
  } else if (!['mcq', 'coding', 'single_select', 'open_text', 'ranking', 'structured_response', 'multi_select'].includes(type)) {
    type = 'open_text'; // fallback for unknown types
  }

  // 2. Canonicalize section and enforce strict validation (never silently fall back)
  const canonicalSection = canonicalizeCategory(rawSection);
  if (!canonicalSection) {
    throw new Error(
      `Invalid or unrecognized category/section: "${rawSection || 'Empty'}". Supported categories: ${SUPPORTED_DISPLAY_LABELS.join(', ')}`
    );
  }
  const section = canonicalSection;

  // Enforce open-text only for Personality category
  if (isPersonalityCategory(section)) {
    if (type !== 'open_text' || (rawType && !['open_text', 'open text'].includes(rawType))) {
      throw new Error(
        `Invalid question type "${rawType || type}" for Personality category: Personality only supports open-text questions.`
      );
    }
  }

  // 3. Construct unified optionsJson object
  let optionsJson: any = {};
  let correctAnswer = '';

  if (type === 'mcq' || type === 'single_select' || type === 'multi_select') {
    const options: { text: string }[] = [];
    
    // Support wizard structure (rawData.options array) or Excel structure (Option 1, Option 2...)
    if (Array.isArray(rawData.options)) {
      rawData.options.forEach((opt: any) => {
        if (opt && typeof opt.text === 'string' && opt.text.trim()) {
          options.push({ text: opt.text.trim() });
        }
      });
    } else {
      if (rawData['Option 1']) options.push({ text: String(rawData['Option 1']) });
      if (rawData['Option 2']) options.push({ text: String(rawData['Option 2']) });
      if (rawData['Option 3']) options.push({ text: String(rawData['Option 3']) });
      if (rawData['Option 4']) options.push({ text: String(rawData['Option 4']) });
    }

    // Special case for yes_no mapped to mcq
    if (rawType === 'yes_no' && options.length === 0) {
      options.push({ text: 'Yes' }, { text: 'No' });
    }

    optionsJson.options = options;
    
    // Correct Answer parsing
    if (type !== 'single_select') {
      const rawAnswer = String(rawData.correctAnswer || rawData['Correct Answer'] || '').trim();
      if (rawType === 'yes_no' && !rawAnswer) {
        correctAnswer = '0';
      } else {
        correctAnswer = rawAnswer;
      }
    }
  } else if (type === 'coding') {
    // Support wizard structure or Excel structure
    optionsJson = {
      constraints: String(rawData.constraints || rawData['Constraints'] || ''),
      sampleInput: String(rawData.sampleInput || rawData['Sample Input'] || ''),
      sampleOutput: String(rawData.sampleOutput || rawData['Sample Output'] || ''),
      starterCode: String(rawData.starterCode || rawData['Starter Code'] || ''),
      language: String(rawData.language || rawData['Language'] || 'javascript')
    };
  } else if (type === 'structured_response') {
    optionsJson = {
      fields: Array.isArray(rawData.fields) ? rawData.fields : []
    };
  } else if (type === 'ranking') {
    const options: { text: string }[] = [];
    if (Array.isArray(rawData.options)) {
      rawData.options.forEach((opt: any) => {
        if (opt && typeof opt.text === 'string' && opt.text.trim()) {
          options.push({ text: opt.text.trim() });
        }
      });
    }
    optionsJson = {
      options,
      allowPartialMarks: !!rawData.allowPartialMarks
    };
    
    // Sort options by rank to determine the correct answer array
    if (Array.isArray(rawData.options)) {
      const sorted = [...rawData.options].sort((a: any, b: any) => Number(a.rank) - Number(b.rank));
      const correctOrder = sorted.map(o => o.text.trim()).filter(Boolean);
      correctAnswer = JSON.stringify(correctOrder);
    }
  }

  if (['open_text', 'structured_response'].includes(type)) {
    const minW = rawData.minWords ?? rawData['Min Words'];
    const maxW = rawData.maxWords ?? rawData['Max Words'];
    if (minW !== undefined && minW !== null && minW !== '') optionsJson.minWords = Number(minW);
    if (maxW !== undefined && maxW !== null && maxW !== '') optionsJson.maxWords = Number(maxW);
  }


  // Preserve specialized scenario and case study metadata if provided
  if (rawData.scenario) optionsJson.scenario = String(rawData.scenario);
  if (rawData.caseStudyTitle) optionsJson.caseStudyTitle = String(rawData.caseStudyTitle);
  if (rawData.caseStudyBackground) optionsJson.caseStudyBackground = String(rawData.caseStudyBackground);
  if (rawData.caseStudyContext) optionsJson.caseStudyContext = String(rawData.caseStudyContext);
  if (rawData.caseStudyProblemStatement) optionsJson.caseStudyProblemStatement = String(rawData.caseStudyProblemStatement);
  if (rawData.caseStudySupportingInfo) optionsJson.caseStudySupportingInfo = String(rawData.caseStudySupportingInfo);
  if (rawType && rawType !== type && !['yes_no', 'coding_mcq'].includes(rawType)) {
    optionsJson.subtype = rawType;
  }


  // 4. Construct Final Payload
  const showsMarks = !isEligibilityCategory(section) && !isPersonalityCategory(section);
  
  const payload = {
    ...(rowIndex !== undefined ? { _rowIndex: rowIndex } : {}),
    questionText: String(rawData.questionText || rawData['Question Text'] || ''),
    type,
    section,
    points: type === 'single_select' ? 0 : (showsMarks ? (Number(rawData.points || rawData['Points']) || 0) : 0),
    timeLimitSeconds: (Number(rawData.expectedDuration || rawData['Expected Duration']) ? Number(rawData.expectedDuration || rawData['Expected Duration']) * 60 : Number(rawData.timeLimitSeconds || rawData['Time Limit'])) || 60,
    isPublished: rawData.isPublished !== undefined ? rawData.isPublished : true,
    explanation: (rawData.explanation || rawData['Explanation']) ? String(rawData.explanation || rawData['Explanation']) : undefined,
    expectedDuration: Number(rawData.expectedDuration || rawData['Expected Duration']) || 5,
    optionsJson,
    correctAnswer: correctAnswer || undefined,
    weight: Number(rawData.weight) || 1,
    isRequired: rawData.isRequired !== undefined ? rawData.isRequired : true
  };

  return payload;
}
