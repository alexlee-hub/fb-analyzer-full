export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { links, token } = req.body;
  if (!token || !links?.length) return res.status(400).json({ error: 'Thiếu token hoặc link' });

  const results = [];

  for (const url of links) {
    try {
      const postId = extractPostId(url);
      if (!postId) throw new Error('Không tìm thấy Post ID');

      const base = `https://graph.facebook.com/v20.0/${postId}?access_token=${token}`;

      // Main info + shares
      const mainRes = await fetch(`${base}&fields=message,created_time,shares`);
      const main = await mainRes.json();

      // Likes
      const likesRes = await fetch(`https://graph.facebook.com/v20.0/${postId}/likes?summary=true&limit=0&access_token=${token}`);
      const likesData = await likesRes.json();
      const likes = likesData.summary?.total_count || 0;

      // Comments count
      const commRes = await fetch(`https://graph.facebook.com/v20.0/${postId}/comments?summary=true&limit=0&access_token=${token}`);
      const commData = await commRes.json();
      const comments = commData.summary?.total_count || 0;

      // Reactions
      const reactRes = await fetch(`https://graph.facebook.com/v20.0/${postId}/reactions?summary=true&limit=0&access_token=${token}`);
      const reactData = await reactRes.json();
      const reactions = reactData.summary?.total_count || 0;

      // Top 5 comments (thật, sắp xếp theo like)
      const topRes = await fetch(`https://graph.facebook.com/v20.0/${postId}/comments?fields=message,like_count,from&limit=10&access_token=${token}`);
      const topData = await topRes.json();
      const topComments = (topData.data || [])
        .sort((a, b) => (b.like_count || 0) - (a.like_count || 0))
        .slice(0, 5)
        .map(c => ({
          message: c.message?.slice(0, 120) || '(Không có nội dung)',
          likes: c.like_count || 0,
          user: c.from?.name || 'Người dùng'
        }));

      const shares = main.shares?.count || 0;
      const engagement = comments > 0 
        ? ((likes + shares + comments) / 100).toFixed(1) + '%' 
        : '0%';

      results.push({
        link: url,
        success: true,
        message: main.message || 'Bài không có văn bản',
        likes,
        shares,
        comments,
        reactions,
        engagement,
        topComments,
        created: main.created_time
      });
    } catch (e) {
      results.push({ link: url, success: false, error: e.message });
    }
  }

  res.json({ success: true, results });
}

function extractPostId(url) {
  const match = url.match(/(\d{10,20})/);
  return match ? match[0] : null;
}