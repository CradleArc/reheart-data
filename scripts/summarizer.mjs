import fs from 'fs';
import path from 'path';

function getDateString() {
  const d = new Date();
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const STOPWORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us', 'is', 'am', 'are', 'was', 'were', 'been', 'being', 'has', 'had', 'does', 'did', 'doing', 'im', 'ive', 'dont', 'doesnt', 'cant', 'wont', 'isnt', 'arent', 'wasnt', 'werent', 'hasnt', 'havent', 'should', 'might', 'must', 'shall', 'why', 'where', 'whom', 'whose', 'many', 'much', 'more', 'very', 'too', 'really', 'such', 'got', 'getting', 'years', 'months', 'days', 'weeks', 'told', 'said', 'going', 'need', 'feel', 'help', 'advice', 'submitted', 'link', 'comments', 'comment', 'something', 'never', 'together', 'things', 'friend', 'life', 'didnt', 'recently', 'since', 'hes', 'feels', 'love', 'friends', 'always', 'still', 'someone', 'around', 'anything', 'everything', 'nothing', 'everyone', 'anyone', 'before', 'right', 'down', 'off', 'through', 'while', 'though', 'although', 'men', 'women', 'guy', 'girl', 'boy', 'man', 'woman', 'guys', 'girls', 'boys', 'ask', 'asked', 'telling', 'saying', 'talk', 'talking'
]);

const DICTIONARY = [
  'ghosting', 'gaslighting', 'ex', 'cheating', 'boundaries', 'red flag', 'toxic', 'narcissist', 'breakup', 'fwb', 'situationship', 'soft launch', 'breadcrumbing', 'microcheating', 'boyfriend', 'girlfriend', 'husband', 'wife', 'dating', 'relationship', 'long distance', 'silent treatment', 'no contact', 'love bombing'
];

function tokenize(text) {
  const cleanText = text.replace(/<[^>]*>?/gm, ' ').toLowerCase().replace(/[^a-z\s]/g, '');
  const words = cleanText.split(/\s+/);
  const tokens = [];

  DICTIONARY.forEach(dictWord => {
    if (dictWord.includes(' ') && cleanText.includes(dictWord)) {
      const count = (cleanText.match(new RegExp('\\b' + dictWord + '\\b', 'g')) || []).length;
      for (let i = 0; i < count; i++) tokens.push(dictWord);
    }
  });

  for (let i = 0; i < words.length; i++) {
    const w1 = words[i];
    if (w1.length > 2 && !STOPWORDS.has(w1)) {
      tokens.push(w1);
      if (i < words.length - 1) {
        const w2 = words[i+1];
        if (w2.length > 2 && !STOPWORDS.has(w2)) {
          tokens.push(`${w1} ${w2}`);
        }
      }
    }
  }
  return tokens;
}

async function runSummarizer() {
  const dateStr = getDateString();
  const rawPostsDir = path.join(process.cwd(), 'raw_posts', dateStr);
  
  if (!fs.existsSync(rawPostsDir)) {
    console.log(`No raw posts found for today (${dateStr}). Exiting.`);
    return;
  }

  const files = fs.readdirSync(rawPostsDir).filter(f => f.endsWith('.json'));
  const allPosts = [];
  
  files.forEach(file => {
    const content = fs.readFileSync(path.join(rawPostsDir, file), 'utf-8');
    try {
      const posts = JSON.parse(content);
      allPosts.push(...posts);
    } catch (e) {}
  });

  // Deduplicate across all day's posts
  const uniquePosts = [];
  const links = new Set();
  allPosts.forEach(p => {
    if (!links.has(p.link)) {
      uniquePosts.push(p);
      links.add(p.link);
    }
  });

  const isQuestion = t => t.includes('?') || /^(how|why|is|are|do|does|did|can|should|what|when|where)/i.test(t);
  const validPosts = uniquePosts.filter(p => isQuestion(p.title));
  
  const wordFreq = {};
  validPosts.forEach(p => {
    const tokens = tokenize(p.title + " " + p.content);
    new Set(tokens).forEach(t => wordFreq[t] = (wordFreq[t] || 0) + 1);
  });

  const rankedWords = Object.keys(wordFreq).map(word => {
    const rawCount = wordFreq[word];
    const isDictWord = DICTIONARY.includes(word);
    const isBigram = word.includes(' ');
    
    let score = rawCount;
    if (isDictWord) score *= 5;
    else if (isBigram) score *= 2;

    return { word, score, rawCount, isDictWord };
  }).sort((a, b) => b.score - a.score).slice(0, 20);

  const finalTrends = rankedWords.map(tw => {
    const matched = validPosts.filter(p => p.title.toLowerCase().includes(tw.word));
    return {
      keyword: tw.word,
      trendStatus: tw.isDictWord ? '🔥 Hot' : 'Trending',
      stats: `${tw.rawCount} recent mentions`,
      description: `Current trending discussions surrounding '${tw.word}'.`,
      questions: matched.slice(0, 3).map(m => m.title)
    };
  });

  const dailyTrendsDir = path.join(process.cwd(), 'daily_trends');
  fs.mkdirSync(dailyTrendsDir, { recursive: true });
  
  // Save today's snapshot
  const dailyPath = path.join(dailyTrendsDir, `${dateStr}.json`);
  fs.writeFileSync(dailyPath, JSON.stringify(finalTrends, null, 2));
  
  // Save latest.json for frontend
  const latestPath = path.join(dailyTrendsDir, `latest.json`);
  fs.writeFileSync(latestPath, JSON.stringify(finalTrends, null, 2));

  console.log(`✅ Summarized ${uniquePosts.length} posts into top 20 trends.`);
  
  // Trigger Vercel Build (if VERCEL_WEBHOOK_URL is set in GH secrets)
  if (process.env.VERCEL_WEBHOOK_URL) {
    console.log("Triggering Vercel rebuild...");
    await fetch(process.env.VERCEL_WEBHOOK_URL, { method: 'POST' });
  } else {
    console.log("Skipping Vercel rebuild (VERCEL_WEBHOOK_URL not set).");
  }
}

runSummarizer();
