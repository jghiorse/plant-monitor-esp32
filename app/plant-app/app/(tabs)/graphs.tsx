import { Picker } from '@react-native-picker/picker';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { SafeAreaView } from 'react-native-safe-area-context';

// --- CONFIG ---
// REPLACE with your actual PythonAnywhere URL
const BASE_URL = 'https://jghiorse.pythonanywhere.com'; 

const screenWidth = Dimensions.get("window").width;

export default function GraphsScreen() {
  const [data, setData] = useState<any[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(""); 
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 1. Fetch the list of available dates (runs once on mount)
  const fetchDates = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/dates`);
      const json = await response.json();
      setDates(json);
      
      // Default to the most recent date (first in list) if we haven't selected one
      if (!selectedDate && json.length > 0) {
        setSelectedDate(json[0]); 
      }
    } catch (error) {
      console.error("Date Fetch Error:", error);
    }
  };

  // 2. Fetch the sensor data for the currently selected date
  const fetchData = async () => {
    if (!selectedDate) return;
    
    setLoading(true);
    try {
      console.log(`Fetching data for: ${selectedDate}`);
      const response = await fetch(`${BASE_URL}/api/history_by_date?date=${selectedDate}`);
      const json = await response.json();
      setData(json);
    } catch (error) {
      console.error("Data Fetch Error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial Load
  useEffect(() => {
    fetchDates();
  }, []);

  // When selectedDate changes (or first load), fetch the actual data
  useEffect(() => {
    if (selectedDate) {
      fetchData();
    }
  }, [selectedDate]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDates(); // Refresh the date list too (in case a new day started)
    await fetchData();
  };

  // Helper to make X-Axis labels readable
  const getLabels = () => {
    if (data.length === 0) return ["00:00"];
    
    // If showing "All Time", showing HH:MM is confusing. Show Date instead.
    const isAllTime = selectedDate === 'All Time';

    return data.map((d) => {
      const timestamp = d.timestamp; // "2025-12-23 14:30:00"
      if (isAllTime) {
         // Return "12-23" for All Time view
         return timestamp.substring(5, 10); 
      } else {
         // Return "14:30" for Daily view
         return timestamp.split(' ')[1].substring(0, 5);
      }
    })
    // Filter to show roughly 5-6 labels across the screen
    .filter((_, index) => index % Math.ceil(data.length / 5) === 0);
  };

  // GENERIC CHART CONFIG
  const chartConfig = {
    backgroundGradientFrom: "#fff",
    backgroundGradientTo: "#fff",
    decimalPlaces: 1, 
    color: (opacity = 1) => `rgba(46, 125, 50, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: { borderRadius: 16 },
    propsForDots: { r: "3", strokeWidth: "1", stroke: "#ffa726" }
  };

  return (
    <SafeAreaView style={styles.container}>
      
      {/* --- DATE SELECTOR HEADER --- */}
      <View style={styles.pickerContainer}>
        <Text style={styles.pickerLabel}>Showing Data For:</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={selectedDate}
            onValueChange={(itemValue) => setSelectedDate(itemValue)}
            style={styles.picker}
            itemStyle={{height: 120}} // Fix for iOS wheel height
          >
            <Picker.Item label="All Time" value="All Time" />
            {dates.map((date) => (
              <Picker.Item key={date} label={date} value={date} />
            ))}
          </Picker>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading && data.length === 0 ? (
           <ActivityIndicator size="large" color="#2e7d32" style={{marginTop: 50}} />
        ) : data.length === 0 ? (
          <View style={styles.noData}>
            <Text style={styles.noDataText}>No data for {selectedDate}</Text>
          </View>
        ) : (
          <>
            {/* --- MOISTURE CHART --- */}
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>💧 Soil Moisture</Text>
              <LineChart
                data={{
                  labels: getLabels(),
                  datasets: [{ data: data.map(d => d.soil_moisture) }]
                }}
                width={screenWidth - 40}
                height={220}
                yAxisLabel=""
                yAxisSuffix=""
                chartConfig={{...chartConfig, color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`}} 
                bezier
                style={styles.chart}
              />
            </View>

            {/* --- SOIL TEMP CHART (NEW) --- */}
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>🌡 Soil Temp (°F)</Text>
              <LineChart
                data={{
                  labels: getLabels(),
                  datasets: [{ data: data.map(d => d.soil_temp_f) }]
                }}
                width={screenWidth - 40}
                height={220}
                yAxisLabel=""
                yAxisSuffix="°"
                chartConfig={{...chartConfig, color: (opacity = 1) => `rgba(121, 85, 72, ${opacity})`}} // Brown
                bezier
                style={styles.chart}
              />
            </View>

            {/* --- AIR TEMP CHART --- */}
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>🌡 Air Temp (°F)</Text>
              <LineChart
                data={{
                  labels: getLabels(),
                  datasets: [{ data: data.map(d => d.air_temp_f) }]
                }}
                width={screenWidth - 40}
                height={220}
                yAxisLabel=""
                yAxisSuffix="°"
                chartConfig={{...chartConfig, color: (opacity = 1) => `rgba(255, 152, 0, ${opacity})`}} 
                bezier
                style={styles.chart}
              />
            </View>

            {/* --- HUMIDITY CHART (NEW) --- */}
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>☁️ Humidity (%)</Text>
              <LineChart
                data={{
                  labels: getLabels(),
                  datasets: [{ data: data.map(d => d.humidity) }]
                }}
                width={screenWidth - 40}
                height={220}
                yAxisLabel=""
                yAxisSuffix="%"
                chartConfig={{...chartConfig, color: (opacity = 1) => `rgba(100, 181, 246, ${opacity})`}} // Light Blue
                bezier
                style={styles.chart}
              />
            </View>

            {/* --- LUX CHART --- */}
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>☀️ Light (Lux)</Text>
              <LineChart
                data={{
                  labels: getLabels(),
                  datasets: [{ data: data.map(d => d.lux) }]
                }}
                width={screenWidth - 40}
                height={220}
                yAxisLabel=""
                yAxisSuffix=""
                chartConfig={{...chartConfig, color: (opacity = 1) => `rgba(255, 235, 59, ${opacity})`}} 
                bezier
                style={styles.chart}
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { padding: 20, paddingBottom: 50 },
  
  // Picker Styles
  pickerContainer: {
    backgroundColor: '#fff',
    padding: 10,
    borderBottomWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    zIndex: 10,
  },
  pickerLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    fontWeight: '600',
  },
  pickerWrapper: {
    width: '100%',
    height: Platform.OS === 'ios' ? 100 : 50, // iOS needs height for the wheel
    justifyContent: 'center',
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
    backgroundColor: '#fff',
  },

  // Chart Styles
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 10,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartTitle: { fontSize: 18, fontWeight: '600', marginBottom: 10, color: '#444' },
  chart: { marginVertical: 8, borderRadius: 16 },
  noData: { marginTop: 50, alignItems: 'center' },
  noDataText: { fontSize: 18, color: '#555', fontWeight: 'bold' },
});