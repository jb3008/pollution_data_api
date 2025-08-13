const express = require("express");
const axios = require("axios");
const NodeCache = require("node-cache");
const basicAuth = require("basic-auth");

const app = express();
const cache = new NodeCache({ stdTTL: 3600 }); // cache 1 hour
const tokenCache = new NodeCache({ stdTTL: 3500 }); // token ~58 min

const BASE_URL = "https://be-recruitment-task.onrender.com";
const USER = "testuser";
const PASS = "testpass";

function auth(req, res, next) {
  const user = basicAuth(req);
  if (!user || user.name !== USER || user.pass !== PASS) {
    res.set("WWW-Authenticate", 'Basic realm="example"');
    return res.status(401).send("Authentication required.");
  }
  next();
}

async function getAuthToken() {
  let token = tokenCache.get("authToken");
  if (token) return token;

  try {
    const resp = await axios.post(`${BASE_URL}/auth/login`, {
      username: USER,
      password: PASS,
    });
    token = resp.data.token;
    tokenCache.set("authToken", token);
    return token;
  } catch (err) {
    console.error("Error getting auth token:", err.message);
    throw new Error("Auth failed");
  }
}

// City validation logic
function isValidCity(entry) {
  if (!entry.name || typeof entry.name !== "string") return false;
  const name = entry.name.trim();

  if (!/^[A-Za-z\s.'-]+$/.test(name)) return false;
  if (name.length < 2) return false;

  if (typeof entry.pollution !== "number") return false;

  return true;
}

// Wikipedia enrichment with caching
async function fetchWikipediaDescription(city) {
  const cached = cache.get(city);
  if (cached) return cached;

  try {
    const resp = await axios.get(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
        city
      )}`
    );
    const desc = resp.data.extract || "No description available";
    cache.set(city, desc);
    return desc;
  } catch {
    cache.set(city, "No description available");
    return "No description available";
  }
}

function getCountryCode(countryName) {
  const countries = {
    Poland: "PL",
    Germany: "DE",
    Spain: "ES",
    France: "FR",
  };

  // Normalize input (case-insensitive)
  const normalized = countryName.trim().toLowerCase();

  for (const [name, code] of Object.entries(countries)) {
    if (name.toLowerCase() === normalized) {
      return code;
    }
  }
  return null; // Not found
}

app.get("/cities", auth, async (req, res) => {
  try {
    const token = await getAuthToken();
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const { data } = await axios.get(
      `${BASE_URL}/pollution?&page=${page}&limit=${limit}&country=${getCountryCode(
        req.query.country
      )}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const validCities = data.results.filter(isValidCity).map((c) => ({
      city: c.name.trim(),
      country: req.query.country.trim(),
      pollution: c.pollution,
    }));

    const results = [];
    for (const cityObj of validCities) {
      const desc = await fetchWikipediaDescription(cityObj.city);
      results.push({ ...cityObj, description: desc });
    }
    //Total is not possible because the API does not return it.
    res.json({
      page: data.meta.page,
      limit: limit,
      cities: results,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(3000, () => console.log("Server running at http://localhost:3000"));
