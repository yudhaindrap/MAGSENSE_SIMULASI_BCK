import sys
import json
import os

try:
    import pandas as pd
    import joblib
    HAS_LIBS = True
except ImportError:
    HAS_LIBS = False

def main():
    try:
        if len(sys.argv) < 2:
            print(json.dumps({"error": "No input data provided"}))
            sys.exit(1)
            
        input_data = json.loads(sys.argv[1])
        model_path = os.path.join(os.path.dirname(__file__), 'model_xgboost_regressor.pkl')
        
        # Mappings based on specs
        features = {
            'suhu_udara_c': float(input_data.get('suhu_udara_c', 0)),
            'kelembapan_udara_pct': float(input_data.get('kelembapan_udara_pct', 0)),
            'kelembapan_media_pct': float(input_data.get('kelembapan_media_pct', 0)),
            'jumlah_baby_larva': int(input_data.get('jumlah_baby_larva', 0)),
            'jumlah_adult_larva': int(input_data.get('jumlah_adult_larva', 0)),
            'jumlah_prepupa': int(input_data.get('jumlah_prepupa', 0)),
            'jumlah_pupa': int(input_data.get('jumlah_pupa', 0))
        }

        # Fallback simulation logic if ML environment isn't completely set up or missing pkl
        dummy_pred_days = max(0.0, 15 - (features['suhu_udara_c'] * 0.1) - (features['jumlah_prepupa'] * 0.3))
        
        if HAS_LIBS and os.path.exists(model_path):
            try:
                df = pd.DataFrame([features])
                model = joblib.load(model_path)
                prediction = model.predict(df)[0]
                print(json.dumps({"harvest_predictions": float(prediction)}))
            except Exception as e:
                # Return dummy safely if model prediction errors out
                print(json.dumps({"harvest_predictions": float(dummy_pred_days), "warning": str(e)}))
        else:
            # Output mathematically simulated ML for web-dev purposes
            print(json.dumps({
                "harvest_predictions": float(dummy_pred_days), 
                "info": "Calculated via fallback logic (missing pandas/joblib/pkl)"
            }))

    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
