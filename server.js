const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');
const User = require('./models/User');
const { verifyToken } = require('./middleware/auth');

const app = express();
app.use(bodyParser.json());

const mongoURI = 'mongodb+srv://AdminBoy:DoggyDoggerson@calypte.mjhlc43.mongodb.net/test?retryWrites=true&w=majority';

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch((err) => console.error('MongoDB connection error:', err));

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashedPassword });
    await user.save();
    res.send('User registered successfully');
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).send('Error registering user');
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(400).send('User not found');
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).send('Invalid password');
    const token = jwt.sign({ userId: user._id }, 'secret', { expiresIn: '1h' });
    res.json({ token });
  } catch (error) {
    console.error('Error logging in user:', error);
    res.status(500).send('Error logging in user');
  }
});

app.post('/scrape', verifyToken, async (req, res) => {
  const { keywords, userId, platform, minLikes = 10 } = req.body;
  const maxKeywords = 5;
  const maxItems = 5;

  if (keywords.length > maxKeywords) {
    return res.status(400).send(`Please limit your search to ${maxKeywords} keywords.`);
  }

  const apifyToken = 'apify_api_aw4NGV3uzan2gniGzNINypffs6aits1CKT5T';

  if (!apifyToken) {
    return res.status(500).send('Apify API token not set');
  }

  try {
    console.log(`Starting scrape for user ${userId} on platform ${platform}`);
    let results = [];
    if (platform === 'twitter') {
      const twitterInput = {
        startUrls: [
          "https://twitter.com/apify/status/1727706472623091883",
          "https://twitter.com/apify",
          "https://twitter.com/search?q=apify%20&src=typed_query",
          "https://twitter.com/i/lists/78783491",
          "https://twitter.com/elonmusk/likes",
          "https://twitter.com/elonmusk/with_replies"
        ],
        searchTerms: keywords,
        maxItems,
      };

      console.log('Twitter input:', twitterInput);

      const run = await axios.post(`https://api.apify.com/v2/acts/apidojo~tweet-scraper/run-sync-get-dataset-items?token=${apifyToken}`, twitterInput);
      const data = run.data;

      console.log('Twitter API response:', data);

      if (!Array.isArray(data)) {
        console.error('Twitter API response is not an array:', data);
        return res.status(500).send('Invalid response from Twitter API');
      }

      // Filter and clean data
      results = data.filter(tweet => {
        console.log(`Tweet ID: ${tweet.id}, Likes: ${tweet.likeCount}`);
        return tweet.likeCount >= minLikes;
      }).map(tweet => ({
        text: tweet.text,
        likes: tweet.likeCount
      }));

      if (results.length === 0) {
        console.error('No relevant tweets found from the Twitter API');
        return res.status(500).send('No relevant tweets found');
      }
    } else if (platform === 'instagram') {
      const instagramInput = {
        directUrls: ["https://www.instagram.com/humansofny/"],
        resultsType: "posts",
        resultsLimit: maxItems,
        searchType: "hashtag",
        searchLimit: 1,
        addParentData: false
      };

      console.log('Instagram input:', instagramInput);

      const run = await axios.post(`https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apifyToken}`, instagramInput);
      const data = run.data;

      console.log('Instagram API response:', data);

      if (!Array.isArray(data)) {
        console.error('Instagram API response is not an array:', data);
        return res.status(500).send('Invalid response from Instagram API');
      }

      results = data.filter(post => post.likes >= minLikes).map(post => ({
        text: post.caption,
        likes: post.likes
      }));

      if (results.length === 0) {
        console.error('No relevant posts found from the Instagram API');
        return res.status(500).send('No relevant posts found');
      }
    } else {
      return res.status(400).send('Unsupported platform');
    }

    console.log('Filtered and cleaned results:', results);

    // Save results to MongoDB
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send('User not found');
    }
    user.searchHistory.push({ keyword: keywords.join(', '), results });
    await user.save();

    console.log('Results saved to user search history');

    // Save results to file (overwrite each time)
    fs.writeFileSync('results.json', JSON.stringify(results, null, 2));

    console.log('Results saved to results.json');
    res.send('Scrape completed successfully');
  } catch (error) {
    console.error('Error scraping data:', error.response ? error.response.data : error.message);
    res.status(500).send('Error scraping data');
  }
});

app.listen(5001, () => console.log('Server running on port 5001'));
