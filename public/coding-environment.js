// Technical keywords to detect in candidate's responses
const technicalKeywords = [
    'Recursion', 'Iteration', 'Optimization', 'Sorting', 'Searching', 
    'Graph', 'Tree', 'Heap', 'Stack', 'Queue', 'LinkedList', 'Hashing', 
    'Binary', 'Trie', 'DFS', 'BFS', 'Greedy', 'DP', 'Backtracking', 
    'BruteForce', 'Modulo', 'Bitwise', 'Strings', 'Integer', 'Floating', 
    'EdgeCase', 'TestCase', 'Compile', 'Debug', 'Syntax', 'Execution', 
    'Performance', 'Latency', 'Concurrency', 'Threading', 'Locking', 
    'Deadlock', 'Mutex', 'Cache', 'MemoryLeak', 'Garbage', 'Collector', 
    'Heap', 'StackOverflow', 'Segmentation', 'Pointer', 'Reference', 
    'Lambda', 'Function', 'Constructor'
  ];
  
  // Convert keywords to lowercase for case-insensitive matching
  const technicalKeywordsLower = technicalKeywords.map(keyword => keyword.toLowerCase());
  
  // Analyze transcript for technical proficiency
  function analyzeTechnicalSkills(transcriptData) {
    // Filter only candidate messages
    const candidateMessages = transcriptData.filter(msg => msg.user === 'Candidate');
    
    if (candidateMessages.length === 0) {
      return {
        score: 5, // Default score if no messages
        keywordsUsed: [],
        feedback: "Not enough data to assess technical skills."
      };
    }
    
    // Combine all messages into one text for analysis
    const combinedText = candidateMessages.map(msg => msg.text.toLowerCase()).join(' ');
    
    // Detect technical keywords used
    const keywordsUsed = [];
    const keywordCounts = {};
    
    technicalKeywordsLower.forEach(keyword => {
      // Use regular expression to find whole word matches
      const regex = new RegExp('\\b' + keyword + '\\b', 'gi');
      const matches = combinedText.match(regex);
      
      if (matches) {
        keywordsUsed.push(keyword);
        keywordCounts[keyword] = matches.length;
      }
    });
    
    // Calculate score based on unique keywords used
    // More unique technical terms = higher score, with a max of 10
    let baseScore = Math.min(10, 5 + Math.floor(keywordsUsed.length / 3));
    
    // Adjust score based on message length and engagement
    const avgMessageLength = candidateMessages.reduce((sum, msg) => sum + msg.text.length, 0) / candidateMessages.length;
    let lengthBonus = 0;
    
    if (avgMessageLength > 100) lengthBonus = 1; // Detailed responses
    if (avgMessageLength < 20) lengthBonus = -1; // Very short responses
    
    const finalScore = Math.min(10, Math.max(1, baseScore + lengthBonus));
    
    // Generate feedback
    let feedback = "";
    if (keywordsUsed.length > 10) {
      feedback = "Candidate demonstrates exceptional technical vocabulary and understanding of various computer science concepts.";
    } else if (keywordsUsed.length > 5) {
      feedback = "Candidate shows good technical knowledge with appropriate use of technical terminology.";
    } else if (keywordsUsed.length > 0) {
      feedback = "Candidate uses some technical terms but could demonstrate broader technical vocabulary.";
    } else {
      feedback = "Candidate uses limited technical terminology in their responses.";
    }
    
    return {
      score: finalScore,
      keywordsUsed,
      keywordCounts,
      feedback
    };
  }
  
  // Grammar and communication analysis
  function analyzeCommunication(transcriptData) {
    // Filter only candidate messages
    const candidateMessages = transcriptData.filter(msg => msg.user === 'Candidate');
    
    if (candidateMessages.length === 0) {
      return {
        score: 5,
        feedback: "Not enough data to assess communication skills."
      };
    }
    
    // Combine all messages for analysis
    const combinedText = candidateMessages.map(msg => msg.text).join(' ');
    
    // Check for common grammatical errors
    const errorPatterns = [
      { pattern: /\b(is|are|was|were)\s+\w+ing\b/gi, type: 'improper progressive' },
      { pattern: /\b(i|we|they|you|he|she)\s+\w+s\b/gi, type: 'subject-verb agreement' },
      { pattern: /\b(has|have)\s+\w+ed\b/gi, type: 'improper perfect tense' },
      { pattern: /\b(their|there|they're|your|you're|its|it's)\b/gi, type: 'common homophones' },
      { pattern: /\s[.,;]\s*/g, type: 'punctuation spacing' },
      { pattern: /\s\s+/g, type: 'double spacing' },
      { pattern: /\bi\b/g, type: 'capitalization' },
      { pattern: /^\s*[a-z]/gm, type: 'sentence capitalization' },
      { pattern: /[^\.\?\!]\s*$/gm, type: 'missing end punctuation' }
    ];
    
    let errorCount = 0;
    let errorTypes = new Set();
    
    errorPatterns.forEach(({ pattern, type }) => {
      const matches = combinedText.match(pattern);
      if (matches) {
        errorCount += matches.length;
        errorTypes.add(type);
      }
    });
    
    // Calculate communication metrics
    const totalWords = combinedText.split(/\s+/).length;
    const sentenceCount = combinedText.split(/[.!?]+/).length - 1;
    const avgWordsPerSentence = sentenceCount > 0 ? totalWords / sentenceCount : totalWords;
    
    // Score calculation
    let baseScore = 8; // Start with a good score
    
    // Deduct for errors - more weight on error ratio than raw count
    const errorRatio = errorCount / totalWords;
    if (errorRatio > 0.1) baseScore -= 3;
    else if (errorRatio > 0.05) baseScore -= 2;
    else if (errorRatio > 0.02) baseScore -= 1;
    
    // Adjust for very short or very verbose answers
    if (avgWordsPerSentence > 30) baseScore -= 1; // Too verbose
    if (avgWordsPerSentence < 5 && candidateMessages.length > 3) baseScore -= 1; // Too terse
    
    // Adjust for engagement level
    if (candidateMessages.length < 3) baseScore -= 1; // Limited engagement
    
    const finalScore = Math.min(10, Math.max(1, baseScore));
    
    // Generate feedback
    let feedback = "";
    if (finalScore >= 8) {
      feedback = "Candidate communicates clearly and effectively with proper grammar and structure.";
    } else if (finalScore >= 6) {
      feedback = "Candidate communicates adequately but with some grammatical or structural issues.";
    } else {
      feedback = "Candidate's communication could be improved, with attention to grammar and sentence structure.";
    }
    
    if (errorTypes.size > 0) {
      feedback += " Common issues include: " + Array.from(errorTypes).join(", ") + ".";
    }
    
    return {
      score: finalScore,
      errorCount,
      errorTypes: Array.from(errorTypes),
      avgWordsPerSentence,
      feedback
    };
  }
  
  // Problem-solving assessment based on coding performance and approach
  function analyzeProblemSolving(codingResults, transcriptData) {
    // If no coding results, base only on transcript
    if (!codingResults || codingResults.length === 0) {
      // Analyze transcript for problem-solving indicators
      const candidateMessages = transcriptData.filter(msg => msg.user === 'Candidate');
      
      if (candidateMessages.length === 0) {
        return {
          score: 5,
          feedback: "Not enough data to assess problem-solving skills."
        };
      }
      
      // Look for problem-solving keywords in transcript
      const problemSolvingKeywords = [
        'approach', 'solution', 'algorithm', 'complexity', 'efficient', 'optimize',
        'analyze', 'consider', 'alternative', 'trade-off', 'design', 'implement',
        'test', 'edge case', 'debug', 'fix', 'improve', 'refactor'
      ];
      
      const combinedText = candidateMessages.map(msg => msg.text.toLowerCase()).join(' ');
      
      let keywordMatches = 0;
      problemSolvingKeywords.forEach(keyword => {
        if (combinedText.includes(keyword)) keywordMatches++;
      });
      
      const baseScore = 5 + Math.min(3, Math.floor(keywordMatches / 3));
      
      return {
        score: baseScore,
        feedback: "Assessment based on interview discussion only. No coding exercises completed."
      };
    }
    
    // With coding results, do a more thorough analysis
    let totalProblems = codingResults.length;
    let solvedProblems = codingResults.filter(result => result.solved).length;
    let partialSolves = codingResults.filter(result => result.partialSolution).length;
    
    // Calculate efficiency and approach metrics
    let efficiencyScore = 0;
    let approachScore = 0;
    let testingScore = 0;
    
    codingResults.forEach(result => {
      if (result.efficiency) efficiencyScore += result.efficiency;
      if (result.approach) approachScore += result.approach;
      if (result.testing) testingScore += result.testing;
    });
    
    // Normalize scores
    efficiencyScore = totalProblems > 0 ? efficiencyScore / totalProblems : 0;
    approachScore = totalProblems > 0 ? approachScore / totalProblems : 0;
    testingScore = totalProblems > 0 ? testingScore / totalProblems : 0;
    
    // Calculate overall problem-solving score
    const solutionRatio = totalProblems > 0 ? (solvedProblems + 0.5 * partialSolves) / totalProblems : 0;
    
    // Weight: 40% solution rate, 20% efficiency, 20% approach, 20% testing
    const weightedScore = (solutionRatio * 0.4) + (efficiencyScore * 0.2) + 
                          (approachScore * 0.2) + (testingScore * 0.2);
    
    const finalScore = Math.min(10, Math.max(1, Math.round(weightedScore * 10)));
    
    // Generate feedback
    let feedback = "";
    
    if (finalScore >= 8) {
      feedback = `Excellent problem-solving skills. Solved ${solvedProblems}/${totalProblems} problems efficiently with optimal approaches.`;
    } else if (finalScore >= 6) {
      feedback = `Good problem-solving skills. Solved or partially solved ${solvedProblems + partialSolves}/${totalProblems} problems.`;
    } else {
      feedback = `Developing problem-solving skills. Successfully solved ${solvedProblems}/${totalProblems} problems.`;
    }
    
    return {
      score: finalScore,
      solvedRatio: solutionRatio,
      efficiencyScore,
      approachScore,
      testingScore,
      feedback
    };
  }
  
  // Comprehensive assessment that combines all metrics
  function generateComprehensiveAssessment(transcriptData, malpracticeIncidents, codingResults) {
    const technicalAssessment = analyzeTechnicalSkills(transcriptData);
    const communicationAssessment = analyzeCommunication(transcriptData);
    const problemSolvingAssessment = analyzeProblemSolving(codingResults, transcriptData);
    
    // Reduce integrity score based on malpractice incidents
    const integrityScore = Math.max(3, 10 - malpracticeIncidents.length * 2);
    
    // Generate strengths based on scores
    const strengths = [];
    
    if (technicalAssessment.score >= 8) {
      strengths.push("Strong technical knowledge with appropriate use of technical terminology");
      if (technicalAssessment.keywordsUsed.length > 0) {
        const topKeywords = technicalAssessment.keywordsUsed.slice(0, 3);
        strengths.push(`Demonstrated knowledge in: ${topKeywords.join(', ')}`);
      }
    }
    
    if (communicationAssessment.score >= 8) {
      strengths.push("Clear and concise communication with proper structure");
      strengths.push("Well-articulated responses with minimal grammatical errors");
    }
    
    if (problemSolvingAssessment.score >= 8) {
      strengths.push("Excellent problem-solving approach");
      strengths.push("Efficient solution implementation with attention to optimization");
    }
    
    if (integrityScore >= 8) {
      strengths.push("Demonstrated professional integrity throughout the interview");
    }
    
    // Add general strengths if we don't have many specific ones
    if (strengths.length < 3) {
      const generalStrengths = [
        "Asked thoughtful questions about the role or problem",
        "Showed willingness to learn and adapt",
        "Demonstrated logical thinking process",
        "Good understanding of fundamental concepts"
      ];
      
      while (strengths.length < 3 && generalStrengths.length > 0) {
        strengths.push(generalStrengths.shift());
      }
    }
    
    // Generate improvement areas based on scores
    const improvements = [];
    
    if (technicalAssessment.score < 7) {
      improvements.push("Could improve depth and breadth of technical vocabulary");
      improvements.push("Would benefit from more exposure to technical concepts and terminology");
    }
    
    if (communicationAssessment.score < 7) {
      improvements.push("Communication could be more structured and concise");
      if (communicationAssessment.errorTypes.length > 0) {
        improvements.push(`Work on grammar issues related to: ${communicationAssessment.errorTypes.slice(0, 2).join(', ')}`);
      }
    }
    
    if (problemSolvingAssessment.score < 7) {
      improvements.push("Problem-solving approach could be more methodical");
      improvements.push("Should practice more algorithmic thinking and solution optimization");
    }
    
    if (integrityScore < 7) {
      improvements.push("Professional conduct during technical assessments needs improvement");
    }
    
    // Generate overall summary
    const overallScore = Math.round((technicalAssessment.score + communicationAssessment.score + 
                                     problemSolvingAssessment.score + integrityScore) / 4);
    
    let summary = "";
    
    if (overallScore >= 8) {
      summary = "The candidate demonstrated strong technical knowledge and communication skills throughout the interview. Their problem-solving approach was methodical and effective, showing excellent potential for the role.";
    } else if (overallScore >= 6) {
      summary = "The candidate showed adequate technical knowledge with reasonable communication skills. Their problem-solving approach was satisfactory but could be improved in some areas.";
    } else {
      summary = "The candidate struggled with some technical aspects and communication could be improved. Their problem-solving approach would benefit from more structure and practice.";
    }
    
    if (malpracticeIncidents.length > 0) {
      summary += ` However, there were ${malpracticeIncidents.length} integrity concerns during the interview that should be considered in the evaluation.`;
    }
    
    return {
      technicalScore: technicalAssessment.score,
      communicationScore: communicationAssessment.score,
      problemSolvingScore: problemSolvingAssessment.score,
      integrityScore,
      overallScore,
      summary,
      strengths,
      improvements,
      technicalDetails: technicalAssessment,
      communicationDetails: communicationAssessment,
      problemSolvingDetails: problemSolvingAssessment
    };
  }
  
  // Export functions for use in the main application
  window.interviewAssessment = {
    analyzeTechnicalSkills,
    analyzeCommunication,
    analyzeProblemSolving,
    generateComprehensiveAssessment
  }