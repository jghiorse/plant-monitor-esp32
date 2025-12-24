import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

// --- CONFIGURATION ---
const SERVER_URL = 'https://jghiorse.pythonanywhere.com/api/history'; 

export default function App() {
  const [data, setData] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("Never");

  // MODE: "isManual" determines if we show the loading spinner
  const fetchData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    
    try {
      console.log(isManual ? "Pull-to-Refresh..." : "Auto-Refreshing...");
      const response = await fetch(SERVER_URL);
      const json = await response.json();
      setData(json);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      console.error("Fetch Error:", error);
      if (isManual) {
        alert("Could not connect to server.");
      }
    } finally {
      if (isManual) setRefreshing(false);
    }
  };

  // --- TIME FORMATTER HELPER ---
  const formatTimestamp = (timestampStr: string) => {
    if (!timestampStr) return '--';
    
    // 1. Python sends "YYYY-MM-DD HH:MM:SS" (Space separator, no timezone)
    // 2. We replace space with 'T' and add 'Z' to tell JS "This is UTC time"
    const safeDate = timestampStr.replace(" ", "T") + "Z";
    const dateObj = new Date(safeDate);

    // 3. Convert to Local Time (12-hour format)
    return dateObj.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  useEffect(() => {
    fetchData(false);
    const intervalId = setInterval(() => {
      fetchData(false); 
    }, 10000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🌱 Plant Monitor</Text>
        <Text style={styles.subtitle}>Last Updated: {lastUpdated}</Text>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} />
        }
      >
        {data.length === 0 ? (
          <Text style={styles.emptyText}>Loading data...</Text>
        ) : (
          data.map((reading: any, index: number) => {
            const battLevel = reading.batt_pct || 0;
            const isLowBatt = battLevel < 20;
            const battIconColor = isLowBatt ? '#d32f2f' : '#388e3c'; 
            const battIconName = isLowBatt ? 'battery-dead' : 'battery-full';

            return (
              <View key={index} style={styles.card}>
                {/* USE NEW FORMATTER HERE */}
                <Text style={styles.timestamp}>{formatTimestamp(reading.timestamp)}</Text>
                
                {/* --- SOIL MOISTURE --- */}
                <View style={styles.row}>
                  <View style={styles.labelContainer}>
                    <Ionicons name="water-outline" size={20} color="#0288d1" />
                    <Text style={styles.label}> Moisture</Text>
                  </View>
                  <Text style={styles.value}>{reading.soil_moisture}</Text>
                </View>

                {/* --- SOIL TEMP --- */}
                <View style={styles.row}>
                  <View style={styles.labelContainer}>
                    <Ionicons name="thermometer-outline" size={20} color="#795548" /> 
                    <Text style={styles.label}> Soil Temp</Text>
                  </View>
                  <Text style={styles.value}>
                    {reading.soil_temp_f ? reading.soil_temp_f.toFixed(1) + '°F' : '--'}
                  </Text>
                </View>

                {/* --- AIR TEMP --- */}
                <View style={styles.row}>
                  <View style={styles.labelContainer}>
                    <Ionicons name="thermometer-outline" size={20} color="#f57c00" />
                    <Text style={styles.label}> Air Temp</Text>
                  </View>
                  <Text style={styles.value}>
                    {reading.air_temp_f ? reading.air_temp_f.toFixed(1) + '°F' : '--'}
                  </Text>
                </View>

                {/* --- HUMIDITY --- */}
                <View style={styles.row}>
                  <View style={styles.labelContainer}>
                    <Ionicons name="cloudy-outline" size={20} color="#90caf9" />
                    <Text style={styles.label}> Humidity</Text>
                  </View>
                  <Text style={styles.value}>
                    {reading.humidity ? reading.humidity.toFixed(1) + '%' : '--'}
                  </Text>
                </View>

                {/* --- LIGHT --- */}
                <View style={styles.row}>
                  <View style={styles.labelContainer}>
                    <Ionicons name="sunny-outline" size={20} color="#fbc02d" />
                    <Text style={styles.label}> Light</Text>
                  </View>
                  <Text style={styles.value}>
                    {reading.lux ? reading.lux.toFixed(0) + ' Lux' : '--'}
                  </Text>
                </View>

                {/* --- BATTERY --- */}
                <View style={[styles.row, { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10, marginTop: 5 }]}>
                  <View style={styles.labelContainer}>
                    <Ionicons name={battIconName} size={20} color={battIconColor} />
                    <Text style={styles.label}> Battery</Text>
                  </View>
                  <View style={{alignItems: 'flex-end'}}>
                    <Text style={[styles.value, { color: battIconColor }]}>
                      {reading.batt_pct ? reading.batt_pct.toFixed(0) + '%' : '--'}
                    </Text>
                    <Text style={styles.subValue}>
                      {reading.batt_volts ? reading.batt_volts.toFixed(2) + ' V' : ''}
                    </Text>
                  </View>
                </View>

              </View>
            );
          })
        )}
      </ScrollView>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#2e7d32',
    paddingTop: 60, 
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    color: '#a5d6a7',
    marginTop: 5,
    fontSize: 14,
  },
  scroll: {
    padding: 20,
    paddingBottom: 50,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#888',
    lineHeight: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    alignItems: 'center',
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
    color: '#555',
    marginLeft: 5,
  },
  value: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  subValue: {
    fontSize: 12,
    color: '#999',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginBottom: 15,
    textAlign: 'left',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  }
});