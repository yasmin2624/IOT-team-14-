import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import toast from "react-hot-toast";
import mqtt from "mqtt";
import FullLoader from "./FullLoader";

export default function Dashboard() {
  const [userName, setUserName] = useState("");
  const [activeTab, setActiveTab] = useState("realtime");
  const [logs, setLogs] = useState([]);
  const [allLogs, setAllLogs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [doorStatus, setDoorStatus] = useState("Closed");
  const [loading, setLoading] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [rfidTag, setRfidTag] = useState("");
  const [currentRfidTags, setCurrentRfidTags] = useState([]);
  const [rfidLoading, setRfidLoading] = useState(false);

  // Combined useEffect for initial data fetching
  useEffect(() => {
    async function initializeData() {
      try {
        setLoading(true);

        // Load user data
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setUserName(user?.user_metadata?.full_name || user?.email || "User");

        // Load initial realtime logs (last 10)
        const { data: logsData } = await supabase
          .from("access_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10);
        if (logsData) setLogs(logsData);

        // Load all history logs and filter for alerts
        const { data: allLogsData } = await supabase
          .from("access_logs")
          .select("*")
          .order("created_at", { ascending: false });
        if (allLogsData) {
          setAllLogs(allLogsData);
          setAlerts(
            allLogsData.filter(
              (log) =>
                log.method?.toLowerCase().includes("emergency") &&
                log.status?.toLowerCase().includes("success")
            )
          );
        }

        // Fetch initial RFID tags
        await fetchRfidTags();
      } catch (error) {
        console.error("Error loading initial data:", error);
      } finally {
        setLoading(false);
      }
    }
    initializeData();
  }, []);

  // Fetch RFID tags function
  const fetchRfidTags = async () => {
    try {
      const { data: row, error } = await supabase
        .from("system_settings")
        .select("rfid_tag")
        .maybeSingle();
      if (error) throw error;
      setCurrentRfidTags(Array.isArray(row?.rfid_tag) ? row.rfid_tag : []);
    } catch (err) {
      console.error("Error fetching RFID tags:", err);
      toast.error("Failed to fetch RFID tags.");
    }
  };

  // ===== MQTT Setup =====
  useEffect(() => {
    const client = mqtt.connect("wss://broker.hivemq.com:8884/mqtt");

    client.on("connect", () => {
      console.log("✅ Connected to MQTT broker");
      client.subscribe("esp32/door/status");
    });

    client.on("message", (topic, message) => {
      if (topic === "esp32/door/status") {
        setDoorStatus(message.toString());
      }
    });

    window.mqttClient = client;

    return () => client.end();
  }, []);

  // Realtime Logs & Alerts from Supabase
  useEffect(() => {
    const logChannel = supabase
      .channel("realtime-logs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "access_logs" },
        (payload) => {
          console.log("📡 Realtime event:", payload);

          if (payload.eventType === "INSERT") {
            const newRow = payload.new;
            setLogs((prev) => [newRow, ...prev].slice(0, 10));
            setAllLogs((prev) => [newRow, ...prev]);

            if (
              newRow.method?.toLowerCase() === "emergency" &&
              newRow.status?.toLowerCase() === "success"
            ) {
              setAlerts((prev) => [newRow, ...prev]);
              toast.error(
                `🚨 Emergency detected at ${new Date(
                  newRow.created_at
                ).toLocaleTimeString()}`
              );
            }
          }
        }
      )
      .subscribe((status) => {
        console.log("🔔 Subscription status:", status);
      });

    return () => {
      supabase.removeChannel(logChannel);
    };
  }, []);

  // ===== Functions to control door via MQTT + log to Supabase =====
  const openDoor = async () => {
    window.mqttClient?.publish("esp32/door1/control", "open");
    setDoorStatus("Opening...");
    toast.success("🚪 Open command sent!");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", user.id)
        .maybeSingle();

      if (profile) {
        await supabase.from("access_logs").insert([
          {
            user_id: profile.id,
            status: "success",
            method: "remote-open",
            created_at: new Date().toISOString(),
          },
        ]);
      }
    }
  };

  const closeDoor = async () => {
    window.mqttClient?.publish("esp32/door1/control", "close");
    setDoorStatus("Closing...");
    toast("🚪 Close command sent", { icon: "🔒" });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", user.id)
        .maybeSingle();

      if (profile) {
        await supabase.from("access_logs").insert([
          {
            user_id: profile.id,
            status: "success",
            method: "remote-close",
            created_at: new Date().toISOString(),
          },
        ]);
      }
    }
  };

  const changeDoorPassword = async (e) => {
    e.preventDefault();
    if (!newPassword) return toast.error("Enter a new password");

    setPasswordLoading(true);
    try {
      const { data: row, error: fetchError } = await supabase
        .from("system_settings")
        .select("*")
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!row) {
        const { error: insertError } = await supabase
          .from("system_settings")
          .insert([{ door_password: newPassword }]);
        if (insertError) throw insertError;
      } else {
        const { error: updateError } = await supabase
          .from("system_settings")
          .update({ door_password: newPassword })
          .eq("id", row.id);
        if (updateError) throw updateError;
      }

      toast.success("Door password updated!");
      setNewPassword("");
    } catch (err) {
      toast.error(err.message || "Error updating password");
    } finally {
      setPasswordLoading(false);
    }
  };

  const addRfidTag = async (e) => {
    e.preventDefault();
    if (!rfidTag) {
      return toast.error("Please enter an RFID tag to add.");
    }
    setRfidLoading(true);
    try {
      const { data: row, error: fetchError } = await supabase
        .from("system_settings")
        .select("id, rfid_tag")
        .maybeSingle();

      if (fetchError) throw fetchError;

      const currentTags = Array.isArray(row?.rfid_tag) ? row.rfid_tag : [];
      if (currentTags.includes(rfidTag)) {
        throw new Error("This RFID tag already exists.");
      }

      const updatedTags = [...currentTags, rfidTag];

      const { error: updateError } = await supabase
        .from("system_settings")
        .update({ rfid_tag: updatedTags })
        .eq("id", row?.id || 1);
      
      if (updateError) throw updateError;
      
      toast.success("RFID tag added successfully!");
      setRfidTag("");
      // Update state to reflect the change
      setCurrentRfidTags(updatedTags);
    } catch (err) {
      toast.error(err.message || "Error adding RFID tag.");
    } finally {
      setRfidLoading(false);
    }
  };

  const removeRfidTag = async (tagToRemove) => {
    setRfidLoading(true);
    try {
      const { data: row, error: fetchError } = await supabase
        .from("system_settings")
        .select("id, rfid_tag")
        .maybeSingle();

      if (fetchError) throw fetchError;

      const currentTags = Array.isArray(row?.rfid_tag) ? row.rfid_tag : [];
      const updatedTags = currentTags.filter((tag) => tag !== tagToRemove);

      const { error: updateError } = await supabase
        .from("system_settings")
        .update({ rfid_tag: updatedTags })
        .eq("id", row?.id || 1);

      if (updateError) throw updateError;

      toast.success("RFID tag removed successfully!");
      // Update state to reflect the change
      setCurrentRfidTags(updatedTags);
    } catch (err) {
      toast.error(err.message || "Error removing RFID tag.");
    } finally {
      setRfidLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">
            Welcome, <span className="text-blue-600">{userName}</span>
          </h1>
        </div>

        {/* Tabs */}
        <div className="mb-8 border-b border-gray-300">
          <nav className="flex flex-wrap gap-8">
            {["realtime", "door", "alerts", "history", "password", "rfid"].map((tab) => (
              <button
                key={tab}
                className={`pb-3 px-1 transition-all duration-300 ${
                  activeTab === tab
                    ? "border-b-4 border-blue-600 text-blue-800 font-bold"
                    : "text-gray-600 hover:text-gray-800"
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === "realtime" ? "Realtime Dashboard" : ""}
                {tab === "door" ? "Remote Door Control" : ""}
                {tab === "alerts" ? "Alerts" : ""}
                {tab === "history" ? "History Logs" : ""}
                {tab === "password" ? "Change Door Password" : ""}
                {tab === "rfid" ? "Manage RFID Tags" : ""}
              </button>
            ))}
          </nav>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-96">
            <FullLoader />
          </div>
        ) : (
          <>
            {/* Realtime Dashboard */}
            {activeTab === "realtime" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {/* Door Status Card */}
                <div className="bg-white rounded-xl shadow-lg p-8 flex flex-col items-center justify-center text-center border border-gray-200 transition-all duration-500 hover:scale-[1.02] cursor-pointer">
                  <h2 className="text-2xl font-bold mb-4 text-gray-800">
                    Door Status
                  </h2>
                  <div
                    className={`p-6 rounded-full ${
                      doorStatus.toLowerCase().includes("closed")
                        ? "bg-red-100 text-red-600"
                        : "bg-green-100 text-green-600"
                    } transition-all duration-500 mb-4`}
                  >
                    <span className="text-5xl">
                      {doorStatus.toLowerCase().includes("closed") ? "🔒" : "🔓"}
                    </span>
                  </div>
                  <p
                    className={`text-xl font-bold ${
                      doorStatus.toLowerCase().includes("closed")
                        ? "text-red-600"
                        : "text-green-600"
                    }`}
                  >
                    {doorStatus}
                  </p>
                </div>

                {/* Latest Log Card */}
                <div className="bg-white rounded-xl shadow-lg p-8 flex flex-col justify-center border border-gray-200 transition-all duration-500 hover:scale-[1.02] cursor-pointer">
                  <h2 className="text-2xl font-bold mb-4 text-gray-800">
                    Latest Activity
                  </h2>
                  {logs.length > 0 ? (
                    <div>
                      <p className="text-lg text-gray-700 font-semibold">
                        {logs[0].method}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(logs[0].created_at).toLocaleString()}
                      </p>
                      <span
                        className={`mt-2 px-3 py-1 rounded-full text-xs font-bold ${
                          logs[0].status.toLowerCase() === "success"
                            ? "bg-green-500 text-white"
                            : "bg-red-500 text-white"
                        }`}
                      >
                        {logs[0].status}
                      </span>
                    </div>
                  ) : (
                    <p className="text-gray-500">No logs to display.</p>
                  )}
                </div>

                {/* Alerts Count Card */}
                <div
                  className="bg-white rounded-xl shadow-lg p-8 flex flex-col items-center justify-center text-center border border-gray-200 transition-all duration-500 hover:scale-[1.02] cursor-pointer"
                  onClick={() => setActiveTab("alerts")}
                >
                  <h2 className="text-2xl font-bold mb-4 text-gray-800">
                    Total Alerts
                  </h2>
                  <span className="text-5xl font-extrabold text-red-600 mb-2">
                    {alerts.length}
                  </span>
                  <p className="text-gray-500">Click to view all alerts</p>
                </div>
                
                {/* Latest 5 Activities Card */}
                <div className="lg:col-span-3 bg-white rounded-xl shadow-lg p-8 border border-gray-200">
                    <h2 className="text-2xl font-bold mb-6 text-gray-800">
                        Latest 5 Activities
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm divide-y divide-gray-300">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Time</th>
                                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Method</th>
                                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {logs.slice(0, 5).map((log) => (
                                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 text-gray-700">{new Date(log.created_at).toLocaleString()}</td>
                                        <td className="px-6 py-4 text-gray-700">
                                            <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">
                                                {log.method}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span
                                                className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                    log.status.toLowerCase() === "success"
                                                        ? "bg-green-500 text-white"
                                                        : "bg-red-500 text-white"
                                                }`}
                                            >
                                                {log.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
              </div>
            )}

            {/* Door Control */}
            {activeTab === "door" && (
              <div className="flex justify-center">
                <div className="bg-white rounded-xl shadow-lg p-8 flex flex-col justify-between items-center text-center border border-gray-200">
                  <h2 className="text-2xl font-bold mb-4 text-gray-800">
                    Door Status
                  </h2>
                  <div className="relative w-40 h-56 mb-8">
                    <div className="absolute inset-0 border-4 border-gray-400 rounded-lg"></div>
                    <div
                      className={`absolute inset-y-0 left-0 w-full h-full bg-blue-600 origin-left transition-transform duration-1000 transform rounded-sm border-2 border-white ${
                        doorStatus.toLowerCase().includes("open")
                          ? "rotate-[-110deg]"
                          : "rotate-0"
                      }`}
                    >
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 w-3 h-3 bg-yellow-400 rounded-full"></div>
                    </div>
                  </div>
                  <p
                    className={`text-3xl font-bold my-6 ${
                      doorStatus.toLowerCase().includes("closed")
                        ? "text-red-600"
                        : "text-green-600"
                    } transition-all duration-500`}
                  >
                    {doorStatus}
                  </p>
                  <div className="flex w-full gap-4 mt-4">
                    <button
                      onClick={openDoor}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors duration-200"
                    >
                      Open Door
                    </button>
                    <button
                      onClick={closeDoor}
                      className="flex-1 bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors duration-200"
                    >
                      Close Door
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Alerts */}
            {activeTab === "alerts" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {alerts.map((a) => (
                  <div
                    key={a.id}
                    className="bg-red-50 border-l-4 border-red-500 rounded-lg p-6 shadow-md flex items-center gap-4 transition-transform duration-300 hover:scale-[1.02]"
                  >
                    <span className="text-red-500 text-4xl">🚨</span>
                    <div>
                      <p className="font-bold text-lg text-red-800">
                        {a.method}
                      </p>
                      <p className="text-sm text-gray-600">
                        {new Date(a.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* History Logs */}
            {activeTab === "history" && (
              <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-200">
                <h2 className="text-2xl font-bold mb-6 text-gray-800">
                  History Logs (All)
                </h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm divide-y divide-gray-300">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-6 py-3 text-left font-semibold text-gray-700">
                          Time
                        </th>
                        <th className="px-6 py-3 text-left font-semibold text-gray-700">
                          Method
                        </th>
                        <th className="px-6 py-3 text-left font-semibold text-gray-700">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {allLogs.map((log) => (
                        <tr
                          key={log.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4 text-gray-700">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-gray-700">
                            <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">
                              {log.method}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold ${
                                log.status.toLowerCase() === "success"
                                  ? "bg-green-500 text-white"
                                  : "bg-red-500 text-white"
                              }`}
                            >
                              {log.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "password" && (
              <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-200 max-w-md mx-auto">
                <h2 className="text-2xl font-bold mb-6 text-gray-800">
                  Change Door Password
                </h2>
                <form
                  onSubmit={changeDoorPassword}
                  className="flex flex-col gap-4"
                >
                  <input
                    type="password"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="p-3 border rounded-lg border-gray-300"
                    required
                  />
                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition"
                  >
                    {passwordLoading ? "Saving..." : "Save Password"}
                  </button>
                </form>
              </div>
            )}

            {/* Manage RFID Tags - Enhanced UI with List */}
            {activeTab === "rfid" && (
                <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-200 max-w-md mx-auto">
                    <h2 className="text-2xl font-bold mb-6 text-gray-800">
                        Manage RFID Tags
                    </h2>
                    
                    {/* Add New RFID Tag Form */}
                    <form onSubmit={addRfidTag} className="flex flex-col gap-4 mb-8">
                        <label htmlFor="rfid-input" className="block text-sm font-medium text-gray-700">
                            Add New RFID Tag
                        </label>
                        <div className="flex gap-2">
                            <input
                                id="rfid-input"
                                type="text"
                                placeholder="Enter RFID tag"
                                value={rfidTag}
                                onChange={(e) => setRfidTag(e.target.value)}
                                className="flex-1 p-3 border rounded-lg border-gray-300"
                                required
                            />
                            <button
                                type="submit"
                                disabled={rfidLoading}
                                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                            >
                                {rfidLoading ? "Adding..." : "Add"}
                            </button>
                        </div>
                    </form>
                    
                    <hr className="my-6 border-gray-200"/>

                    {/* List of Existing RFID Tags */}
                    <div>
                        <h3 className="text-xl font-bold mb-4 text-gray-800">Existing Tags</h3>
                        {currentRfidTags.length > 0 ? (
                            <ul className="space-y-3">
                                {currentRfidTags.map((tag) => (
                                    <li key={tag} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg shadow-sm border border-gray-200">
                                        <span className="font-mono text-sm text-gray-700">{tag}</span>
                                        <button
                                            onClick={() => removeRfidTag(tag)}
                                            disabled={rfidLoading}
                                            className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg text-xs font-semibold transition-colors"
                                        >
                                            Remove
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-500 text-sm">No RFID tags found.</p>
                        )}
                    </div>
                </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}