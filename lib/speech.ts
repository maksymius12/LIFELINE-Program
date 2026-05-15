import * as Speech from 'expo-speech';

export const speakInstruction = (text: string) => {
  Speech.stop();
  Speech.speak(text, {
    rate: 0.9,
    pitch: 1.0,
    language: 'en-US',
  });
};

export const stopSpeech = () => {
  Speech.stop();
};
