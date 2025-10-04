import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar, ResponsiveContainer,
  AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";

export default function App() {
  const [handle, setHandle] = useState("");
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [upcomingContests, setUpcomingContests] = useState([]);
  const [userContests, setUserContests] = useState([]);
  const [contestLoading, setContestLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [submissionsPerPage] = useState(20);
  const [recommendedProblems, setRecommendedProblems] = useState([]);
  const [problemLoading, setProblemLoading] = useState(false);
  const [selectedTags, setSelectedTags] = useState([]);
  const [difficultyRange, setDifficultyRange] = useState([800, 3500]);
  const [activeTab, setActiveTab] = useState("analytics");

  const COLORS = ["#00ff88", "#ff0088", "#0088ff", "#ffaa00", "#aa00ff", "#00aaff", "#ff5500"];

  // Available problem tags
  const algorithmCategories = {
    "Basic Techniques": ["implementation", "math", "greedy", "brute force", "sortings"],
    "Data Structures": ["data structures", "strings", "binary search", "two pointers"],
    "Advanced Algorithms": ["dp", "graphs", "dfs and similar", "combinatorics"],
    "Specialized": ["number theory", "geometry", "bitmasks", "constructive algorithms"]
  };

  // Fetch upcoming contests
  const fetchUpcomingContests = async () => {
    setContestLoading(true);
    try {
      const response = await fetch('https://codeforces.com/api/contest.list?gym=false');
      const data = await response.json();

      if (data.status === "OK") {
        const upcoming = data.result
          .filter(contest => contest.phase === "BEFORE")
          .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds)
          .slice(0, 8);
        setUpcomingContests(upcoming);
      }
    } catch (err) {
      console.error("Failed to fetch contests:", err);
    }
    setContestLoading(false);
  };

  // Fetch user's contest history
  const fetchUserContests = async (handle) => {
    try {
      const response = await fetch(`https://codeforces.com/api/user.rating?handle=${handle}`);
      const data = await response.json();

      if (data.status === "OK") {
        setUserContests(data.result.reverse().slice(0, 20)); // Last 20 contests
      }
    } catch (err) {
      console.error("Failed to fetch user contests:", err);
    }
  };

  // Analyze patterns in wrong submissions
  const analyzeWrongSubmissionPatterns = (wrongSubmissions) => {
    const patterns = {};

    wrongSubmissions.forEach(sub => {
      const rating = sub.problem.rating;
      sub.problem.tags?.forEach(tag => {
        const key = `${tag}-${Math.round(rating / 100) * 100}`;
        patterns[key] = (patterns[key] || 0) + 1;
      });
    });

    return Object.entries(patterns)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([key]) => {
        const [tag, rating] = key.split('-');
        return { tag, rating: parseInt(rating) };
      });
  };

  // Get recommendation reason
  const getRecommendationReason = (problem, weakTags, wrongPatterns) => {
    if (weakTags.some(tag => problem.tags?.includes(tag))) {
      return "Targets your weak areas";
    }
    if (wrongPatterns.some(pattern =>
      problem.tags?.includes(pattern.tag) &&
      Math.abs(problem.rating - pattern.rating) <= 200
    )) {
      return "Similar to frequently wrong problems";
    }
    return "Matches your skill level";
  };

  // Calculate contest performance metrics
  const calculateContestPerformance = (contests) => {
    if (!contests.length) return null;

    const performances = contests.map(contest => ({
      ...contest,
      ratingChange: contest.newRating - contest.oldRating,
      performance: contest.newRating > contest.oldRating ? "Good" : "Needs Improvement"
    }));

    const avgRatingChange = performances.reduce((sum, p) => sum + p.ratingChange, 0) / performances.length;
    const bestContest = performances.reduce((best, current) =>
      current.ratingChange > best.ratingChange ? current : best
    );
    const worstContest = performances.reduce((worst, current) =>
      current.ratingChange < worst.ratingChange ? current : worst
    );

    return {
      performances,
      avgRatingChange: Math.round(avgRatingChange),
      bestContest,
      worstContest,
      totalContests: performances.length,
      positivePerformance: performances.filter(p => p.ratingChange > 0).length
    };
  };

  // Get user's weak tags based on performance
  const getWeakTags = (tagStats, wrongTagStats) => {
    return Object.entries(wrongTagStats)
      .filter(([tag, wrongCount]) => {
        const totalAttempts = (tagStats[tag] || 0) + wrongCount;
        const successRate = totalAttempts > 0 ? (tagStats[tag] || 0) / totalAttempts : 0;
        return successRate < 0.5 && totalAttempts >= 3;
      })
      .sort(([,a], [,b]) => a - b)
      .slice(0, 5)
      .map(([tag]) => tag);
  };

  // Get user's strong tags
  const getStrongTags = (tagStats) => {
    return Object.entries(tagStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([tag]) => tag);
  };

  // CORRECT STREAK CALCULATION FUNCTION
  const calculateStreaks = (submissions) => {
    if (submissions.length === 0) return { current: 0, max: 0 };

    // Get unique dates with at least one correct submission
    const solvedDates = new Set();
    submissions.forEach(sub => {
      if (sub.verdict === "OK") {
        const date = new Date(sub.creationTimeSeconds * 1000).toDateString();
        solvedDates.add(date);
      }
    });

    // Convert to sorted array of dates
    const sortedDates = Array.from(solvedDates)
      .map(dateStr => new Date(dateStr))
      .sort((a, b) => a - b);

    if (sortedDates.length === 0) return { current: 0, max: 0 };

    let currentStreak = 1;
    let maxStreak = 1;
    let tempStreak = 1;

    // Calculate streaks
    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = sortedDates[i - 1];
      const currDate = sortedDates[i];

      // Calculate difference in days
      const diffTime = currDate - prevDate;
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      if (diffDays === 1) {
        // Consecutive days
        tempStreak++;
        maxStreak = Math.max(maxStreak, tempStreak);
      } else if (diffDays > 1) {
        // Streak broken
        tempStreak = 1;
      }
      // If same day, don't change tempStreak
    }

    maxStreak = Math.max(maxStreak, tempStreak);

    // Calculate current streak (from today backwards)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let current = 0;
    let checkDate = new Date(today);

    while (true) {
      const dateStr = checkDate.toDateString();
      const hasSubmission = sortedDates.some(date => date.toDateString() === dateStr);

      if (hasSubmission) {
        current++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return {
      current: current,
      max: maxStreak
    };
  };

  // Fetch recommended problems based on weak areas and wrong submissions
  const fetchRecommendedProblems = async (analyticsData, userRating, selectedTags, difficultyRange) => {
    if (!userRating || !analyticsData) return;

    setProblemLoading(true);
    try {
      const response = await fetch('https://codeforces.com/api/problemset.problems');
      const data = await response.json();

      if (data.status === "OK") {
        const problems = data.result.problems;
        const solvedProblems = new Set(
          analyticsData.allSubmissions
            .filter(s => s.verdict === "OK")
            .map(s => `${s.problem.contestId}${s.problem.index}`)
        );

        // Get problems from weak tags and wrong question patterns
        const weakTagProblems = problems.filter(problem => {
          const problemId = `${problem.contestId}${problem.index}`;
          const hasWeakTags = analyticsData.weakTags.some(tag => problem.tags?.includes(tag));
          const inDifficultyRange = problem.rating &&
            problem.rating >= difficultyRange[0] &&
            problem.rating <= difficultyRange[1];
          const hasSelectedTags = selectedTags.length === 0 ||
            selectedTags.some(tag => problem.tags?.includes(tag));

          return hasWeakTags && inDifficultyRange && hasSelectedTags && !solvedProblems.has(problemId);
        });

        // Get problems similar to wrong submissions
        const wrongSubmissionPatterns = analyticsData.commonWrongPatterns;
        const similarProblems = problems.filter(problem => {
          const problemId = `${problem.contestId}${problem.index}`;
          const matchesPattern = wrongSubmissionPatterns.some(pattern =>
            problem.tags?.includes(pattern.tag) &&
            Math.abs(problem.rating - pattern.rating) <= 200
          );
          return matchesPattern && !solvedProblems.has(problemId);
        });

        // Combine and prioritize
        const recommended = [...weakTagProblems, ...similarProblems]
          .sort((a, b) => {
            // Prioritize problems close to user's level
            const aDiff = Math.abs(a.rating - (userRating + 150));
            const bDiff = Math.abs(b.rating - (userRating + 150));
            return aDiff - bDiff;
          })
          .slice(0, 15)
          .map(problem => ({
            ...problem,
            url: `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`,
            recommendationReason: getRecommendationReason(problem, analyticsData.weakTags, wrongSubmissionPatterns)
          }));

        setRecommendedProblems(recommended);
      }
    } catch (err) {
      console.error("Failed to fetch problems:", err);
    }
    setProblemLoading(false);
  };

  // Fetch data when component mounts
  useEffect(() => {
    fetchUpcomingContests();
  }, []);

  // Fetch user data
  const fetchData = async () => {
    if (!handle) return;
    setLoading(true);
    setCurrentPage(1);

    try {
      const [userInfoRes, statusRes] = await Promise.all([
        fetch(`https://codeforces.com/api/user.info?handles=${handle}`),
        fetch(`https://codeforces.com/api/user.status?handle=${handle}&from=1&count=1000`)
      ]);

      const userInfo = await userInfoRes.json();
      const statusData = await statusRes.json();

      if (userInfo.status === "OK" && statusData.status === "OK") {
        setUserData(userInfo.result[0]);
        setAllSubmissions(statusData.result);
        fetchUserContests(handle);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  // Advanced Analytics Calculations
  const analytics = useMemo(() => {
    if (allSubmissions.length === 0) return null;

    const solved = allSubmissions.filter((s) => s.verdict === "OK");
    const wrongSubmissions = allSubmissions.filter((s) => s.verdict !== "OK");
    const total = allSubmissions.length;
    const accuracy = total ? ((solved.length / total) * 100).toFixed(2) : 0;

    // Problem difficulty distribution
    const difficultyDistribution = solved.reduce((acc, sub) => {
      const rating = sub.problem.rating || "Unknown";
      acc[rating] = (acc[rating] || 0) + 1;
      return acc;
    }, {});

    // Problem tags analysis
    const tagStats = {};
    solved.forEach(sub => {
      sub.problem.tags?.forEach(tag => {
        tagStats[tag] = (tagStats[tag] || 0) + 1;
      });
    });

    // Wrong submissions analysis
    const wrongTagStats = {};
    wrongSubmissions.forEach(sub => {
      sub.problem.tags?.forEach(tag => {
        wrongTagStats[tag] = (wrongTagStats[tag] || 0) + 1;
      });
    });

    // Rating progress over time
    const ratingProgress = [];
    const uniqueSolved = new Set();

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

    // Performance by hour
    const hourlyPerformance = Array.from({ length: 24 }, (_, i) => ({ hour: i, submissions: 0, solved: 0 }));
    allSubmissions.forEach(sub => {
      const hour = new Date(sub.creationTimeSeconds * 1000).getHours();
      hourlyPerformance[hour].submissions++;
      if (sub.verdict === "OK") hourlyPerformance[hour].solved++;
    });

    // CORRECT STREAK CALCULATION
    const streaks = calculateStreaks(allSubmissions);

    // Weak tags (tags with low success rate)
    const weakTags = getWeakTags(tagStats, wrongTagStats);

    // Strong tags
    const strongTags = getStrongTags(tagStats);

    // Common wrong patterns
    const commonWrongPatterns = analyzeWrongSubmissionPatterns(wrongSubmissions);

    return {
      solved: solved.length,
      total,
      accuracy,
      difficultyDistribution,
      tagStats,
      wrongTagStats,
      ratingProgress,
      hourlyPerformance,
      streaks, // Use the correctly calculated streaks
      averageDifficulty: solved.length > 0 ?
        Math.round(solved.reduce((sum, sub) => sum + (sub.problem.rating || 0), 0) / solved.length) : 0,
      uniqueSolved: uniqueSolved.size,
      strongTags,
      weakTags,
      wrongSubmissions,
      commonWrongPatterns,
      successRateByHour: hourlyPerformance.map(h => ({
        hour: h.hour,
        successRate: h.submissions > 0 ? (h.solved / h.submissions) * 100 : 0
      })),
      allSubmissions // Include for recommendations
    };
  }, [allSubmissions]);

  // Contest performance analysis
  const contestPerformance = useMemo(() => {
    return calculateContestPerformance(userContests);
  }, [userContests]);

  // Fetch recommended problems when analytics change
  useEffect(() => {
    if (analytics && userData?.rating) {
      fetchRecommendedProblems(analytics, userData.rating, selectedTags, difficultyRange);
    }
  }, [analytics, userData, selectedTags, difficultyRange]);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent mb-2">
          🔥 Codeforces Advanced Analytics
        </h1>
        <p className="text-gray-400">Deep insights beyond standard metrics</p>
      </motion.header>

      {/* Input Section */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex justify-center mb-8"
      >
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Enter your Codeforces handle..."
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            className="px-6 py-3 rounded-xl bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 w-80"
          />
          <button
            onClick={fetchData}
            className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl hover:from-cyan-600 hover:to-blue-600 transition-all font-bold"
          >
            Analyze
          </button>
        </div>
      </motion.div>

      {/* Navigation Tabs */}
      {userData && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex justify-center mb-8"
        >
          <div className="bg-gray-900 rounded-xl p-1 flex flex-wrap gap-1">
            {["analytics", "recommendations", "contests", "submissions", "wrong-questions"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg capitalize transition-all text-sm ${
                  activeTab === tab
                    ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {tab.replace('-', ' ')}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {loading && (
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
          <p className="mt-4 text-cyan-400">Analyzing performance data...</p>
        </div>
      )}

      <AnimatePresence>
        {userData && analytics && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-8"
          >
            {/* Analytics Dashboard */}
            {activeTab === "analytics" && (
              <div className="space-y-8">
                {/* Profile Card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gray-900 rounded-2xl p-6 border border-gray-800"
                >
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    <div>
                      <h2 className="text-2xl font-bold mb-2">{userData.handle}</h2>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Rating: </span>
                          <span className="text-cyan-400 font-bold">{userData.rating || "Unrated"}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Max: </span>
                          <span className="text-blue-400">{userData.maxRating || "N/A"}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Rank: </span>
                          <span className="text-green-400">{userData.rank}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-400">
                        {analytics.streaks.current} day streak 🔥
                      </div>
                      <div className="text-sm text-gray-400">
                        Max: {analytics.streaks.max} days
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Unique Solved", value: analytics.uniqueSolved, color: "from-cyan-500 to-blue-500" },
                    { label: "Accuracy", value: `${analytics.accuracy}%`, color: "from-green-500 to-emerald-500" },
                    { label: "Avg Difficulty", value: analytics.averageDifficulty, color: "from-purple-500 to-pink-500" },
                    { label: "Total Submissions", value: analytics.total, color: "from-orange-500 to-red-500" }
                  ].map((stat, idx) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.1 }}
                      className={`bg-gradient-to-br ${stat.color} rounded-xl p-4 text-white`}
                    >
                      <div className="text-2xl font-bold">{stat.value}</div>
                      <div className="text-sm opacity-90">{stat.label}</div>
                    </motion.div>
                  ))}
                </div>

                {/* Advanced Insights */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Weak Areas */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-gray-900 rounded-2xl p-6 border border-gray-800"
                  >
                    <h3 className="text-xl font-bold mb-4 text-red-400">Areas Needing Improvement</h3>
                    <div className="space-y-3">
                      {analytics.weakTags.length > 0 ? (
                        analytics.weakTags.map((tag, idx) => (
                          <div key={tag} className="flex justify-between items-center">
                            <span className="text-sm">{tag}</span>
                            <div className="flex gap-2 text-xs">
                              <span className="text-green-400">
                                ✓ {analytics.tagStats[tag] || 0}
                              </span>
                              <span className="text-red-400">
                                ✗ {analytics.wrongTagStats[tag] || 0}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-400 text-sm">No significant weak areas detected</p>
                      )}
                    </div>
                  </motion.div>

                  {/* Strong Areas */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-gray-900 rounded-2xl p-6 border border-gray-800"
                  >
                    <h3 className="text-xl font-bold mb-4 text-green-400">Strong Areas</h3>
                    <div className="space-y-3">
                      {analytics.strongTags.map((tag, idx) => (
                        <div key={tag} className="flex justify-between items-center">
                          <span className="text-sm">{tag}</span>
                          <span className="text-green-400 font-bold">
                            {analytics.tagStats[tag]} solved
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </div>

                {/* Performance Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-900 rounded-2xl p-6 border border-gray-800"
                  >
                    <h3 className="text-xl font-bold mb-4">Progress Timeline</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={analytics.ratingProgress.slice(-30)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="date" stroke="#9CA3AF" />
                        <YAxis stroke="#9CA3AF" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                        />
                        <Area
                          type="monotone"
                          dataKey="problems"
                          stroke="#06b6d4"
                          fill="#06b6d4"
                          fillOpacity={0.2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-900 rounded-2xl p-6 border border-gray-800"
                  >
                    <h3 className="text-xl font-bold mb-4">Success Rate by Hour</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analytics.successRateByHour}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="hour" stroke="#9CA3AF" />
                        <YAxis stroke="#9CA3AF" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                          formatter={(value) => [`${value.toFixed(1)}%`, 'Success Rate']}
                        />
                        <Bar dataKey="successRate" fill="#10B981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </motion.div>
                </div>
              </div>
            )}

            {/* Rest of the tabs remain the same */}
            {/* ... (recommendations, contests, wrong-questions, submissions) ... */}

          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-12 pt-6 border-t border-gray-800 text-center text-gray-400"
      >
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="text-sm">
            Advanced Codeforces Analytics 🚀
          </div>
          <div className="flex space-x-6 text-sm">
            <span>Hidden Insights</span>
            <span>Performance Tracking</span>
            <span>Smart Recommendations</span>
          </div>
          <div className="text-sm">
            © 2024 Codeforces Analytics
          </div>
        </div>
      </motion.footer>
    </div>
  );
}
