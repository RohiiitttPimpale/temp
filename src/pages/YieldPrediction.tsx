import { useState } from "react";
import { motion } from "framer-motion";
import { CROPS, simulateWeather, predictYield, WeatherData, CropConfig, YieldResult } from "@/lib/agri-data";
import { useLanguage } from "@/contexts/LanguageContext";
import { CROP_NAME_KEYS, WEATHER_CONDITION_KEYS } from "@/lib/translations";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Cloud, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const YieldPrediction = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const defaultCrop = CROPS.find(c => c.name === user?.preferredCrop) || CROPS[0];

  const [crop, setCrop] = useState<CropConfig>(defaultCrop);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [nitrogen, setNitrogen] = useState(80);
  const [phosphorus, setPhosphorus] = useState(40);
  const [potassium, setPotassium] = useState(30);
  const [ph, setPh] = useState(6.5);
  const [result, setResult] = useState<YieldResult | null>(null);

  const fetchWeather = () => {
    setWeather(simulateWeather());
  };

  const handlePredict = async () => {
    const w = weather || simulateWeather();
    if (!weather) setWeather(w);

    try {
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crop, nitrogen, phosphorus, potassium, ph }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.predictedYield !== undefined) {
          setResult({
            predictedYield: data.predictedYield,
            confidence: data.confidence,
            factors: data.factors,
            unit: data.unit || "tons/ha",
          });
          return;
        }
      }
    } catch {
      // fallback to local simulation when backend unavailable
    }

    const r = predictYield(crop, w, nitrogen, phosphorus, potassium, ph);
    setResult(r);
  };

  const translateCondition = (cond: string) => t(WEATHER_CONDITION_KEYS[cond] || cond);

  return (
    <div>
      <h1 className="text-3xl font-bold text-foreground mb-2">{t("yield_prediction")}</h1>
      <p className="text-muted-foreground mb-8">{t("yield_prediction_desc")}</p>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="agri-card space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("select_crop")}</Label>
              <Select value={crop.name} onValueChange={v => setCrop(CROPS.find(c => c.name === v)!)}>
                <SelectTrigger><SelectValue>{t(CROP_NAME_KEYS[crop.name])}</SelectValue></SelectTrigger>
                <SelectContent>
                  {CROPS.map(c => <SelectItem key={c.name} value={c.name}>{t(CROP_NAME_KEYS[c.name])}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Button variant="outline" className="w-full agri-btn-press" onClick={fetchWeather}>
                <Cloud size={16} className="mr-2" />
                {t("use_today_weather")}
              </Button>
              {weather && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                  <span>🌡️ {weather.temperature}°C</span>
                  <span>💧 {weather.humidity}%</span>
                  <span>🌧️ {weather.rainfall}mm</span>
                  <span>🌤️ {translateCondition(weather.condition)}</span>
                </motion.div>
              )}
            </div>
          </div>

          <div className="agri-card space-y-5">
            <h3 className="font-semibold text-foreground">{t("soil_parameters")}</h3>
            {[
              { label: t("nitrogen"), value: nitrogen, set: setNitrogen, max: 200, unit: "kg/ha" },
              { label: t("phosphorus"), value: phosphorus, set: setPhosphorus, max: 150, unit: "kg/ha" },
              { label: t("potassium"), value: potassium, set: setPotassium, max: 150, unit: "kg/ha" },
            ].map(s => (
              <div key={s.label} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <Label>{s.label}</Label>
                  <span className="text-muted-foreground font-medium">{s.value} {s.unit}</span>
                </div>
                <Slider value={[s.value]} onValueChange={v => s.set(v[0])} max={s.max} step={1} />
              </div>
            ))}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <Label>{t("soil_ph")}</Label>
                <span className="text-muted-foreground font-medium">{ph}</span>
              </div>
              <Slider value={[ph * 10]} onValueChange={v => setPh(v[0] / 10)} max={140} min={30} step={1} />
            </div>

            <Button className="w-full agri-btn-press" onClick={handlePredict}>
              <RefreshCw size={16} className="mr-2" />
              {t("predict_yield_btn")}
            </Button>
          </div>
        </div>

        <div>
          {result ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="agri-card text-center">
                <p className="text-sm text-muted-foreground uppercase tracking-wide mb-2">{t("predicted_yield")} — {t(CROP_NAME_KEYS[crop.name])}</p>
                <p className="text-6xl font-bold text-foreground">{result.predictedYield}</p>
                <p className="text-lg text-muted-foreground mt-1">{result.unit}</p>

                <div className="mt-6">
                  <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${result.confidence}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="h-full bg-primary rounded-full"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{t("confidence")}: {result.confidence}%</p>
                </div>
              </div>

              <div className="agri-card">
                <h3 className="font-semibold text-foreground mb-4">{t("impact_factors")}</h3>
                <div className="space-y-3">
                  {result.factors.map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {f.direction === "up" ? (
                          <ArrowUp size={14} className="text-primary" />
                        ) : (
                          <ArrowDown size={14} className="text-destructive" />
                        )}
                        <span className="text-foreground">{t(f.labelKey, { val: f.val })}</span>
                      </div>
                      <span className={f.impact >= 0 ? "text-primary font-medium" : "text-destructive font-medium"}>
                        {f.impact >= 0 ? "+" : ""}{f.impact}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="agri-card flex flex-col items-center justify-center h-full min-h-[300px] text-center">
              <div className="p-4 rounded-2xl bg-muted mb-4">
                <RefreshCw size={32} className="text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">{t("select_crop_fill_data")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default YieldPrediction;
