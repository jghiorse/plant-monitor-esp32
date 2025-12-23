import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

// --- CONFIGURATION ---
// REPLACE with your PythonAnywhere URL
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
      // Only show the annoying alert if the user explicitly pulled to refresh
      if (isManual) {
        alert("Could not connect to server.");
      }
    } finally {
      if (isManual) setRefreshing(false);
    }
  };

  // --- AUTO-REFRESH LOGIC ---
  useEffect(() => {
    // 1. Load data immediately when app opens (Silent)
    fetchData(false);

    // 2. Set up a timer to run every 10 seconds (10000 ms)
    const intervalId = setInterval(() => {
      fetchData(false); // Silent refresh
    }, 10000);

    // 3. Cleanup: Stop the timer if the user leaves this screen
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
          // When user pulls down, we pass 'true' to show the spinner
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} />
        }
      >
        {data.length === 0 ? (
          <Text style={styles.emptyText}>
            Loading data...
          </Text>
        ) : (
          data.map((reading: any, index: number) => {
            // Logic to determine battery icon color and name
            const battLevel = reading.batt_pct || 0;
            const isLowBatt = battLevel < 20;
            const battIconColor = isLowBatt ? '#d32f2f' : '#388e3c'; // Red vs Green
            const battIconName = isLowBatt ? 'battery-dead' : 'battery-full';

            return (
              <View key={index} style={styles.card}>
                <Text style={styles.timestamp}>{reading.timestamp}</Text>
                
                <View style={styles.row}>
                  <View style={styles.labelContainer}>
                    <Ionicons name="water-outline" size={20} color="#0288d1" />
                    <Text style={styles.label}> Moisture</Text>
                  </View>
                  <Text style={styles.value}>{reading.soil_moisture}</Text>
                </View>

                <View style={styles.row}>
                  <View style={styles.labelContainer}>
                    <Ionicons name="thermometer-outline" size={20} color="#f57c00" />
                    <Text style={styles.label}> Air Temp</Text>
                  </View>
                  <Text style={styles.value}>
                    {reading.air_temp_f ? reading.air_temp_f.toFixed(1) + '°F' : '--'}
                  </Text>
                </View>

                <View style={styles.row}>
                  <View style={styles.labelContainer}>
                    <Ionicons name="sunny-outline" size={20} color="#fbc02d" />
                    <Text style={styles.label}> Light</Text>
                  </View>
                  <Text style={styles.value}>
                    {reading.lux ? reading.lux.toFixed(0) + ' Lux' : '--'}
                  </Text>
                </View>

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