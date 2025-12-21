import { Ionicons } from '@expo/vector-icons'; // Import Icons
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

// --- CONFIGURATION ---
// REPLACE THIS WITH YOUR MAC'S IP ADDRESS
// Note: Use http, not https. Port 5001.
const SERVER_URL = 'http://10.0.0.12:5001/api/history'; 

export default function App() {
  const [data, setData] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("Never");

  const fetchData = async () => {
    setRefreshing(true);
    try {
      console.log("Fetching from:", SERVER_URL);
      const response = await fetch(SERVER_URL);
      const json = await response.json();
      setData(json);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      console.error("Fetch Error:", error);
      alert("Could not connect to server.\nCheck if your Mac IP changed or if the server is running!");
    } finally {
      setRefreshing(false);
    }
  };

  // Fetch data immediately when app opens
  useEffect(() => {
    fetchData();
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
          <RefreshControl refreshing={refreshing} onRefresh={fetchData} />
        }
      >
        {data.length === 0 ? (
          <Text style={styles.emptyText}>
            No data found yet.{'\n'}
            Pull down to refresh!
          </Text>
        ) : (
          data.map((reading, index) => {
            // Logic to determine battery icon color and name
            const battLevel = reading.batt_pct || 0;
            const isLowBatt = battLevel < 20;
            const battIconColor = isLowBatt ? '#d32f2f' : '#388e3c'; // Red vs Green
            const battIconName = isLowBatt ? 'battery-dead' : 'battery-full';

            return (
              <View key={index} style={styles.card}>
                {/* --- HEADER OF CARD (Timestamp) --- */}
                <Text style={styles.timestamp}>{reading.timestamp}</Text>
                
                {/* --- SENSOR ROWS --- */}
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

                {/* --- BATTERY ROW --- */}
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
    paddingTop: 60, // Extra padding for status bar area
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
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    // Shadow for Android
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