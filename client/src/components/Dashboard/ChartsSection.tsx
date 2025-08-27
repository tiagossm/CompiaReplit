import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { BarChart3, TrendingUp } from "lucide-react";

const inspectionTrendsData = [
  { month: "Jan", inspections: 65, compliant: 58, nonCompliant: 7 },
  { month: "Fev", inspections: 78, compliant: 71, nonCompliant: 7 },
  { month: "Mar", inspections: 90, compliant: 82, nonCompliant: 8 },
  { month: "Abr", inspections: 85, compliant: 77, nonCompliant: 8 },
  { month: "Mai", inspections: 95, compliant: 87, nonCompliant: 8 },
  { month: "Jun", inspections: 102, compliant: 94, nonCompliant: 8 }
];

const complianceData = [
  { name: 'Conformes', value: 2632, color: '#10B981' },
  { name: 'Não Conformes', value: 215, color: '#8B5CF6' }
];

export default function ChartsSection() {
  const complianceRate = (complianceData[0].value / (complianceData[0].value + complianceData[1].value) * 100).toFixed(1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="charts-section">
      {/* Inspection Trends Chart */}
      <Card className="chart-container" data-testid="inspection-trends-chart">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-heading font-semibold text-foreground">
              Tendência de Inspeções
            </CardTitle>
            <Select defaultValue="quarter">
              <SelectTrigger className="w-[180px]" data-testid="trend-period-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quarter">Último trimestre</SelectItem>
                <SelectItem value="semester">Últimos 6 meses</SelectItem>
                <SelectItem value="year">Último ano</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64" data-testid="trend-chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={inspectionTrendsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="inspections" 
                  stroke="#3B82F6" 
                  strokeWidth={3}
                  name="Total de Inspeções"
                />
                <Line 
                  type="monotone" 
                  dataKey="compliant" 
                  stroke="#10B981" 
                  strokeWidth={2}
                  name="Conformes"
                />
                <Line 
                  type="monotone" 
                  dataKey="nonCompliant" 
                  stroke="#EF4444" 
                  strokeWidth={2}
                  name="Não Conformes"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Compliance Chart */}
      <Card data-testid="compliance-chart">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-heading font-semibold text-foreground">
              Taxa de Conformidade
            </CardTitle>
            <span 
              className="text-sm font-medium text-compia-green bg-compia-green/10 px-2 py-1 rounded-full"
              data-testid="compliance-rate-badge"
            >
              {complianceRate}%
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center" data-testid="compliance-chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={complianceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {complianceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2" data-testid="compliance-legend">
            {complianceData.map((entry, index) => (
              <div key={index} className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                ></div>
                <span className="text-sm text-muted-foreground">
                  {entry.name} ({entry.value.toLocaleString('pt-BR')})
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
