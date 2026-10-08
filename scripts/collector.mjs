import fs from 'fs';
import path from 'path';
import Parser from 'rss-parser';

// Format YYYY-MM-DD
function getDateString() {
  const d = new Date();
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Format HH_MM
function getTimeString() {
  const d = new Date();
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hours}_${minutes}`;
}

const parser = new Parser({
  headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
});

// For free safety, we can use direct URLs or the proxy. I'll use the proxy to ensure GH Actions isn't blocked.
const RSS_TO_JSON_API = "https://api.rss2json.com/v1/api.json?rss_url=";

const SOURCES = [
  { name: 'Reddit_Relationships', url: `${RSS_TO_JSON_API}https://www.reddit.com/r/relationships/.rss` },
  { name: 'Reddit_Advice', url: `${RSS_TO_JSON_API}https://www.reddit.com/r/relationship_advice/.rss` },
  { name: 'Reddit_BreakUps', url: `${RSS_TO_JSON_API}https://www.reddit.com/r/BreakUps/.rss` },
  { name: 'Reddit_Dating', url: `${RSS_TO_JSON_API}https://www.reddit.com/r/dating/.rss` },
  { name: 'Reddit_DatingAdvice', url: `${RSS_TO_JSON_API}https://www.reddit.com/r/dating_advice/.rss` },
  { name: 'Reddit_Marriage', url: `${RSS_TO_JSON_API}https://www.reddit.com/r/Marriage/.rss` },
  { name: 'Reddit_Divorce', url: `${RSS_TO_JSON_API}https://www.reddit.com/r/Divorce/.rss` },
  { name: 'Reddit_SurvivingInfidelity', url: `${RSS_TO_JSON_API}https://www.reddit.com/r/survivinginfidelity/.rss` },
  { name: 'Reddit_TrueOffMyChest', url: `${RSS_TO_JSON_API}https://www.reddit.com/r/TrueOffMyChest/.rss` }
];

async function fetchSource(source) {
  try {
    const response = await fetch(source.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await response.json();
    if (data && data.items) {
      return data.items.map(item => ({ 
        title: item.title, 
        content: item.description || '', 
        link: item.link, 
        pubDate: item.pubDate 
      }));
    }
  } catch (err) {
    console.error(`Failed to fetch ${source.name}: ${err.message}`);
  }
  return [];
}

async function runCollector() {
  const dateStr = getDateString();
  const timeStr = getTimeString();
  
  const fetchPromises = SOURCES.map(source => fetchSource(source));
  const fetchedArrays = await Promise.all(fetchPromises);
  
  const allPosts = fetchedArrays.flat().filter(Boolean);
  if (allPosts.length === 0) {
    console.log("No data fetched. Exiting.");
    return;
  }

  // Deduplicate by link
  const uniquePosts = [];
  const links = new Set();
  allPosts.forEach(p => {
    if (!links.has(p.link)) {
      uniquePosts.push(p);
      links.add(p.link);
    }
  });

  const dirPath = path.join(process.cwd(), 'raw_posts', dateStr);
  fs.mkdirSync(dirPath, { recursive: true });
  
  const filePath = path.join(dirPath, `${timeStr}.json`);
  fs.writeFileSync(filePath, JSON.stringify(uniquePosts, null, 2));
  
  console.log(`✅ Collected ${uniquePosts.length} posts and saved to ${filePath}`);
}

runCollector();
