import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar, ResponsiveContainer,
  AreaChart, Area
} from "recharts";

export default function App() {
  const [handle, setHandle] = useState("");
  const [userData, setUserData] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [allSubmissions, setAllSubmissions] = useState([]);

  const COLORS = ["#22c55e", "#ef4444", "#3b82f6", "#eab308", "#a855f7", "#06b6d4", "#f97316"];

  // Fetch user profile + submissions
  const fetchData = async () => {
    if (!handle) return;
    setLoading(true);

    try {
      const userInfoRes = await fetch(
        `https://codeforces.com/api/user.info?handles=${handle}`
      );
      const userInfo = await userInfoRes.json();

      // Fetch more submissions for better analytics
      const statusRes = await fetch(
        `https://codeforces.com/api/user.status?handle=${handle}&from=1&count=1000`
      );
      const statusData = await statusRes.json();

      setUserData(userInfo.result[0]);
      setSubmissions(statusData.result.slice(0, 200)); // Recent 200 for table
      setAllSubmissions(statusData.result); // All for analytics
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  };

  // Advanced Analytics Calculations
  const analytics = useMemo(() => {
    if (allSubmissions.length === 0) return null;

    const solved = allSubmissions.filter((s) => s.verdict === "OK");
    const total = allSubmissions.length;
    const accuracy = total ? ((solved.length / total) * 100).toFixed(2) : 0;

    // Problem difficulty distribution
    const difficultyDistribution = solved.reduce((acc, sub) => {
      const rating = sub.problem.rating || "Unknown";
      acc[rating] = (acc[rating] || 0) + 1;
      return acc;
    }, {});

    // Daily activity heatmap (last 30 days)
    const dailyActivity = {};
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    allSubmissions.forEach(sub => {
      const date = new Date(sub.creationTimeSeconds * 1000).toDateString();
      if (new Date(sub.creationTimeSeconds * 1000) >= thirtyDaysAgo) {
        dailyActivity[date] = (dailyActivity[date] || 0) + 1;
      }
    });

    // Problem tags analysis
    const tagStats = {};
    solved.forEach(sub => {
      sub.problem.tags.forEach(tag => {
        tagStats[tag] = (tagStats[tag] || 0) + 1;
      });
    });

    // Rating progress over time
    const ratingProgress = [];
    const uniqueSolved = new Set();
    const ratingTimeline = [];
    let currentRating = 0;

    // Sort by time and track rating changes
    const timeSorted = [...allSubmissions].sort((a, b) => a.creationTimeSeconds - b.creationTimeSeconds);

    timeSorted.forEach(sub => {
      const date = new Date(sub.creationTimeSeconds * 1000);
      if (sub.verdict === "OK") {
        const problemId = `${sub.problem.contestId}-${sub.problem.index}`;
        if (!uniqueSolved.has(problemId)) {
          uniqueSolved.add(problemId);
          ratingProgress.push({
            date: date.toLocaleDateString(),
            problems: uniqueSolved.size,
            rating: sub.problem.rating || 0
          });
        }
      }
    });

    // Contest performance
    const contestStats = allSubmissions
      .filter(sub => sub.author.participantType === "CONTESTANT")
      .reduce((acc, sub) => {
        const contestId = sub.contestId;
        if (!acc[contestId]) {
          acc[contestId] = { solved: 0, total: 0, rating: sub.problem.rating || 0 };
        }
        if (sub.verdict === "OK") acc[contestId].solved++;
        acc[contestId].total++;
        return acc;
      }, {});

    // Streak calculation
    let currentStreak = 0;
    let maxStreak = 0;
    let tempStreak = 0;
    const uniqueDays = new Set();

    timeSorted.forEach(sub => {
      const date = new Date(sub.creationTimeSeconds * 1000).toDateString();
      if (sub.verdict === "OK" && !uniqueDays.has(date)) {
        uniqueDays.add(date);
        tempStreak++;
        maxStreak = Math.max(maxStreak, tempStreak);
      }
    });

    // Recent activity streak (last 7 days)
    const recentDays = new Set();
    const last7Days = Array.from({length: 7}, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toDateString();
    });

    timeSorted.forEach(sub => {
      const date = new Date(sub.creationTimeSeconds * 1000).toDateString();
      if (last7Days.includes(date) && sub.verdict === "OK") {
        recentDays.add(date);
      }
    });
    currentStreak = recentDays.size;

    return {
      solved: solved.length,
      total,
      accuracy,
      difficultyDistribution,
      dailyActivity,
      tagStats,
      ratingProgress,
      contestStats,
      streaks: {
        current: currentStreak,
        max: maxStreak
      },
      averageDifficulty: solved.length > 0 ?
        Math.round(solved.reduce((sum, sub) => sum + (sub.problem.rating || 0), 0) / solved.length) : 0,
      uniqueSolved: uniqueSolved.size
    };
  }, [allSubmissions]);

  // Verdict Statistics
  const verdictStats = [
    { name: "Accepted", value: submissions.filter((s) => s.verdict === "OK").length },
    { name: "Wrong Answer", value: submissions.filter((s) => s.verdict === "WRONG_ANSWER").length },
    { name: "TLE", value: submissions.filter((s) => s.verdict === "TIME_LIMIT_EXCEEDED").length },
    { name: "MLE", value: submissions.filter((s) => s.verdict === "MEMORY_LIMIT_EXCEEDED").length },
    { name: "Runtime Error", value: submissions.filter((s) => s.verdict === "RUNTIME_ERROR").length },
    { name: "Compilation Error", value: submissions.filter((s) => s.verdict === "COMPILATION_ERROR").length },
    { name: "Other", value: submissions.filter((s) => !["OK","WRONG_ANSWER","TIME_LIMIT_EXCEEDED","MEMORY_LIMIT_EXCEEDED","RUNTIME_ERROR","COMPILATION_ERROR"].includes(s.verdict)).length },
  ];

  // XP + Gamification
  const xp = submissions.filter(s => s.verdict === "OK").length * 10;
  const level = Math.floor(xp / 500) + 1;
  const nextLevelXp = level * 500;
  const progress = ((xp % 500) / 500) * 100;

  const badges = [];
  const solvedCount = submissions.filter(s => s.verdict === "OK").length;
  if (solvedCount >= 50) badges.push({ name: "Thinker", icon: "🧠", description: "Solved 50+ problems" });
  if (solvedCount >= 100) badges.push({ name: "Sprinter", icon: "🥇", description: "Solved 100+ problems" });
  if (analytics?.accuracy >= 60) badges.push({ name: "Sharpshooter", icon: "🎯", description: "60%+ accuracy" });
  if (analytics?.streaks.current >= 7) badges.push({ name: "Consistent", icon: "🔥", description: "7-day streak" });
  if (analytics?.averageDifficulty >= 1600) badges.push({ name: "Challenger", icon: "⚔️", description: "Hard problems solver" });

  // Problem tags for chart
  const tagChartData = analytics ?
    Object.entries(analytics.tagStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag, count]) => ({ tag, count })) : [];

  // Difficulty distribution for chart
  const difficultyChartData = analytics ?
    Object.entries(analytics.difficultyDistribution)
      .filter(([rating]) => rating !== "Unknown")
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([rating, count]) => ({ rating: `${rating}`, count })) : [];

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <h1 className="text-3xl font-bold text-center mb-6">
        🚀 Codeforces Analytics Pro
      </h1>

      {/* Input */}
      <div className="flex justify-center mb-6">
        <input
          type="text"
          placeholder="Enter Codeforces handle"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          className="px-4 py-2 rounded-l-lg text-black w-64"
        />
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-indigo-600 rounded-r-lg hover:bg-indigo-700"
        >
          Analyze
        </button>
      </div>

      {loading && (
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          <p className="mt-2">Crunching numbers...</p>
        </div>
      )}

      {userData && analytics && (
        <div className="space-y-8">
          {/* Profile Section */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-900 p-6 rounded-2xl shadow-lg"
          >
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold mb-2">{userData.handle}</h2>
                <p className="text-gray-300">
                  Rating: <span className="text-white">{userData.rating || "Unrated"}</span>
                  (Max: <span className="text-white">{userData.maxRating || "N/A"}</span>)
                </p>
                <p className="text-gray-300">
                  Rank: <span className="text-white">{userData.rank}</span> |
                  Max Rank: <span className="text-white">{userData.maxRank}</span>
                </p>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-green-400">
                  {analytics.streaks.current} day streak 🔥
                </div>
                <div className="text-sm text-gray-300">
                  Max: {analytics.streaks.max} days
                </div>
              </div>
            </div>
          </motion.div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-blue-500 p-4 rounded-xl text-center"
            >
              <div className="text-2xl font-bold">{analytics.uniqueSolved}</div>
              <div className="text-sm">Unique Solved</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-green-500 p-4 rounded-xl text-center"
            >
              <div className="text-2xl font-bold">{analytics.accuracy}%</div>
              <div className="text-sm">Accuracy</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-purple-500 p-4 rounded-xl text-center"
            >
              <div className="text-2xl font-bold">{analytics.averageDifficulty}</div>
              <div className="text-sm">Avg Difficulty</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="bg-orange-500 p-4 rounded-xl text-center"
            >
              <div className="text-2xl font-bold">{analytics.total}</div>
              <div className="text-sm">Total Submissions</div>
            </motion.div>
          </div>

          {/* Gamification */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl shadow-lg text-white"
            >
              <h2 className="text-xl font-bold mb-2">XP Progress</h2>
              <p>Level {level}</p>
              <div className="w-full bg-white/20 rounded-full h-4 mt-2">
                <div
                  className="bg-yellow-400 h-4 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2">{xp} / {nextLevelXp} XP</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 bg-gray-900 rounded-2xl shadow-lg"
            >
              <h2 className="text-xl font-bold mb-4">Badges & Achievements</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {badges.length ? badges.map((badge, idx) => (
                  <motion.div
                    key={idx}
                    whileHover={{ scale: 1.05 }}
                    className="p-3 bg-gray-800 rounded-xl text-center group relative"
                  >
                    <span className="text-2xl">{badge.icon}</span>
                    <p className="text-sm mt-1 font-medium">{badge.name}</p>
                    <div className="absolute bottom-full mb-2 hidden group-hover:block bg-black text-white p-2 rounded text-xs w-32">
                      {badge.description}
                    </div>
                  </motion.div>
                )) : <p className="text-gray-400">Keep solving to earn badges!</p>}
              </div>
            </motion.div>
          </div>

          {/* Advanced Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Problem Solving Progress */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-6 bg-gray-900 rounded-2xl shadow-lg"
            >
              <h2 className="text-xl font-bold mb-4">Problem Solving Progress</h2>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={analytics.ratingProgress.slice(-30)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1F2937', border: 'none' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="problems"
                    stroke="#3B82F6"
                    fill="#3B82F6"
                    fillOpacity={0.2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Difficulty Distribution */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-6 bg-gray-900 rounded-2xl shadow-lg"
            >
              <h2 className="text-xl font-bold mb-4">Difficulty Distribution</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={difficultyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="rating" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1F2937', border: 'none' }}
                  />
                  <Bar dataKey="count" fill="#10B981" />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Tag Distribution */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 bg-gray-900 rounded-2xl shadow-lg"
            >
              <h2 className="text-xl font-bold mb-4">Top Problem Tags</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={tagChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" stroke="#9CA3AF" />
                  <YAxis type="category" dataKey="tag" stroke="#9CA3AF" width={80} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1F2937', border: 'none' }}
                  />
                  <Bar dataKey="count" fill="#8B5CF6" />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Verdict Distribution */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 bg-gray-900 rounded-2xl shadow-lg"
            >
              <h2 className="text-xl font-bold mb-4">Verdict Distribution</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={verdictStats}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {verdictStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1F2937', border: 'none' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </motion.div>
          </div>

          {/* Performance Insights */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 bg-gray-900 rounded-2xl shadow-lg"
          >
            <h2 className="text-xl font-bold mb-4">Performance Insights</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-800 rounded-lg">
                <h3 className="font-bold text-green-400 mb-2">Strengths</h3>
                <ul className="text-sm space-y-1">
                  {tagChartData.slice(0, 3).map((tag, idx) => (
                    <li key={idx}>• Strong in {tag.tag} ({tag.count} solved)</li>
                  ))}
                  {analytics.streaks.current >= 3 && (
                    <li>• Consistent practice ({analytics.streaks.current} day streak)</li>
                  )}
                  {analytics.accuracy >= 70 && (
                    <li>• High accuracy rate ({analytics.accuracy}%)</li>
                  )}
                </ul>
              </div>
              <div className="p-4 bg-gray-800 rounded-lg">
                <h3 className="font-bold text-red-400 mb-2">Areas to Improve</h3>
                <ul className="text-sm space-y-1">
                  {tagChartData.length > 3 && (
                    <li>• Explore {tagChartData.slice(-3).map(t => t.tag).join(', ')}</li>
                  )}
                  {analytics.averageDifficulty < 1400 && (
                    <li>• Try more challenging problems</li>
                  )}
                  {analytics.accuracy < 50 && (
                    <li>• Focus on problem understanding before coding</li>
                  )}
                </ul>
              </div>
            </div>
          </motion.div>

          {/* Submissions Table */}
          <div className="bg-gray-900 p-6 rounded-2xl shadow-lg overflow-auto">
            <h2 className="text-xl font-bold mb-4">Recent Submissions</h2>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="p-2">Problem</th>
                  <th className="p-2">Rating</th>
                  <th className="p-2">Verdict</th>
                  <th className="p-2">Tags</th>
                  <th className="p-2">Time</th>
                  <th className="p-2">Memory</th>
                </tr>
              </thead>
              <tbody>
                {submissions.slice(0, 10).map((s, idx) => (
                  <tr key={idx} className="border-b border-gray-700 hover:bg-gray-800">
                    <td className="p-2">{s.problem.name}</td>
                    <td className="p-2">{s.problem.rating || '-'}</td>
                    <td className={`p-2 font-medium ${
                      s.verdict === 'OK' ? 'text-green-400' :
                      s.verdict === 'WRONG_ANSWER' ? 'text-red-400' :
                      'text-yellow-400'
                    }`}>
                      {s.verdict}
                    </td>
                    <td className="p-2 text-xs">
                      {s.problem.tags.slice(0, 2).join(', ')}
                    </td>
                    <td className="p-2">{s.timeConsumedMillis} ms</td>
                    <td className="p-2">{(s.memoryConsumedBytes/1024).toFixed(2)} KB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
