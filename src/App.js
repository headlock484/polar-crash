// Updated: Buttons reduced by 7% more, gaps reduced, bear moved down and repositioned
import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import bearVideo from './bear.mp4';
import bearStartVideo from './bear_start.mp4';
import bearCrashVideo from './bear_crash.mp4';
import successVideo from './success.mp4';
import bearGameLaunch from './bear_game_launch.mp4';

const socket = io(process.env.REACT_APP_SOCKET_URL || (window.location.origin.includes('localhost') ? 'http://localhost:3001' : window.location.origin));

function App() {
  const [gameState, setGameState] = useState('READY'); 
  const [multiplier, setMultiplier] = useState(1.00);
  const [stake, setStake] = useState(10);
  const [autoPlay, setAutoPlay] = useState(false);
  const [autoBetModalOpen, setAutoBetModalOpen] = useState(false);
  const [autoBetStake, setAutoBetStake] = useState(10);
  const [autoBetRounds, setAutoBetRounds] = useState(1);
  const [autoBetCashout, setAutoBetCashout] = useState(2.0);
  const [autoBetRoundsRemaining, setAutoBetRoundsRemaining] = useState(0);
  const [balance, setBalance] = useState(1000);
  const [showTryAgain, setShowTryAgain] = useState(false);
  const [crashHistory, setCrashHistory] = useState([]);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
  const [showYouLose, setShowYouLose] = useState(false);
  const [showLosingText, setShowLosingText] = useState(false);
  const [isCrashShrunk, setIsCrashShrunk] = useState(false);
  const [successVideoPlaying, setSuccessVideoPlaying] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeMenuSection, setActiveMenuSection] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [betHistory, setBetHistory] = useState([]);
  const [showInfoTooltip, setShowInfoTooltip] = useState(false);
  const [dontShowInfoAgain, setDontShowInfoAgain] = useState(() => {
    return localStorage.getItem('dontShowInfoTooltip') === 'true';
  });

  // Debug: Log desktop state
  useEffect(() => {
    console.log('Desktop state:', isDesktop, 'Window width:', window.innerWidth);
  }, [isDesktop]);
  const videoRef = useRef(null);

  // Handle window resize for responsive styles - only update if crossing threshold
  useEffect(() => {
    const handleResize = () => {
      const newIsDesktop = window.innerWidth >= 768;
      // Only update if crossing the threshold to avoid unnecessary re-renders
      // Also check that we're not in a mobile viewport (some browsers report wrong width)
      if (newIsDesktop !== isDesktop && window.innerWidth >= 768) {
        setIsDesktop(newIsDesktop);
      }
    };
    // Set initial state correctly
    setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Set up socket event handlers
    const handleTick = (m) => {
      setMultiplier(m);
    };
    
    const handleCrash = (m) => {
      setMultiplier(m);
      setGameState('CRASHED');
      setShowTryAgain(false);
      setShowYouLose(false);
      setShowLosingText(false);
      // Add crash multiplier to history
      setCrashHistory(prev => [m.toFixed(2), ...prev].slice(0, 20));
      // Add to bet history
      setBetHistory(prev => [{
        id: Date.now(),
        stake: stake,
        multiplier: m.toFixed(2),
        result: 'LOST',
        timestamp: new Date().toLocaleTimeString()
      }, ...prev].slice(0, 50));
      // Desktop crash sequence: video → shrink immediately → wait 1s for biscuit to dissolve → YOU LOSE → TRY AGAIN
      if (window.innerWidth >= 768) {
        // Shrink immediately when crash happens
        setIsCrashShrunk(true);
        // Delay notifications by 1 second to allow biscuit to dissolve first
        setTimeout(() => {
          setShowYouLose(true);
          setTimeout(() => {
            setShowTryAgain(true);
          }, 1000);
        }, 1500); // Changed from 500ms to 1500ms (1 second delay)
      } else {
        // Mobile: delay by 1 second to allow biscuit to dissolve first
        setTimeout(() => {
          setShowTryAgain(true);
        }, 2000); // Changed from 1000ms to 2000ms (1 second delay)
      }
    };
    
    const handleSuccess = (m) => {
      setMultiplier(m);
      setGameState('CASHED_OUT');
      setShowTryAgain(false); // Reset try again visibility
      // Add to bet history
      const winnings = (stake * m).toFixed(2);
      setBetHistory(prev => [{
        id: Date.now(),
        stake: stake,
        multiplier: m.toFixed(2),
        winnings: parseFloat(winnings),
        result: 'WON',
        timestamp: new Date().toLocaleTimeString()
      }, ...prev].slice(0, 50));
      // Show TRY AGAIN button after 2 seconds
      setTimeout(() => {
        setShowTryAgain(true);
      }, 2000);
    };
    
    // Connection event handlers
    socket.on('connect', () => {
      console.log('Socket connected!');
    });
    
    socket.on('disconnect', () => {
      console.log('Socket disconnected!');
    });
    
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });
    
    // Register event handlers
    socket.on('tick', handleTick);
    socket.on('crash', handleCrash);
    socket.on('success', handleSuccess);
    
    return () => {
      socket.off('tick', handleTick);
      socket.off('crash', handleCrash);
      socket.off('success', handleSuccess);
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
    };
  }, [stake, socket]);

  // Auto-close info tooltip after 4 seconds
  useEffect(() => {
    if (showInfoTooltip && !dontShowInfoAgain) {
      const timer = setTimeout(() => {
        setShowInfoTooltip(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [showInfoTooltip, dontShowInfoAgain]);

  const successVideoRef = useRef(null);
  const crashVideoRef = useRef(null);
  const successVideoPreloadRef = useRef(null);
  const dippingVideoRef = useRef(null);
  const crashVideoElementRef = useRef(null);

  // Handle crash video when CRASHED state
  useEffect(() => {
    if (gameState !== 'CRASHED') return;
    
    const video = crashVideoElementRef.current;
    if (!video) {
      // Video element not ready yet, wait a bit
      const timer = setTimeout(() => {
        const v = crashVideoElementRef.current;
        if (v && gameState === 'CRASHED') {
          // Force reload for mobile
          v.load();
          // Wait for video to be ready before seeking and playing
          const playWhenReady = () => {
            if (v.readyState >= 2) {
              v.currentTime = 1.25;
              const playPromise = v.play();
              if (playPromise !== undefined) {
                playPromise.catch(console.error);
              }
            } else {
              setTimeout(playWhenReady, 50);
            }
          };
          v.addEventListener('canplay', () => {
            v.currentTime = 1.25;
            v.play().catch(console.error);
          }, { once: true });
          playWhenReady();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
    
    // Video element exists, ensure it plays continuously
    video.loop = false;
    
    // Force reload video for mobile (prevents static image after multiple plays)
    video.load();
    
    const source = video.querySelector('source');
    if (source && source.src && source.src.includes('bear_crash')) {
      // Source is correct, load and play
      // Ensure video continues playing if it pauses
      const handlePause = () => {
        if (gameState === 'CRASHED' && !video.ended) {
          video.play().catch(console.error);
        }
      };
      
      // Check periodically to ensure video is playing
      const checkPlaying = () => {
        if (gameState === 'CRASHED' && video.paused && !video.ended) {
          video.play().catch(console.error);
        }
      };
      
      const playCrashVideo = () => {
        // For mobile: start from 0, then seek to ensure playback
        video.currentTime = 0;
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            // Once playing, seek to 1.25 seconds
            if (video.readyState >= 2) {
              video.currentTime = 1.25;
            } else {
              video.addEventListener('canplay', () => {
                video.currentTime = 1.25;
              }, { once: true });
            }
          }).catch(error => {
            console.error('Error playing crash video:', error);
            // Retry
            setTimeout(() => {
              video.currentTime = 0;
              video.play().then(() => {
                if (video.readyState >= 2) {
                  video.currentTime = 1.25;
                }
              }).catch(console.error);
            }, 100);
          });
        }
      };
      
      video.addEventListener('pause', handlePause);
      const playingInterval = setInterval(checkPlaying, 500);
      
      if (video.readyState >= 4) {
        playCrashVideo();
      } else if (video.readyState >= 2) {
        playCrashVideo();
      } else {
        video.addEventListener('canplay', playCrashVideo, { once: true });
        video.addEventListener('loadeddata', playCrashVideo, { once: true });
      }
      
      return () => {
        clearInterval(playingInterval);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('canplay', playCrashVideo);
        video.removeEventListener('loadeddata', playCrashVideo);
      };
    } else {
      // Source not ready, wait and retry
      const timer = setTimeout(() => {
        if (video && gameState === 'CRASHED') {
          video.load();
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [gameState]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    // Handle video playback based on game state
    if (gameState === 'DIPPING') {
      // Start the bear start video when game starts - play from beginning
      video.loop = false; // We'll handle looping manually for seamless playback
      // Start from the beginning for seamless playback
      video.currentTime = 0;
      video.play().catch(console.error);
    } else if (gameState === 'CRASHED') {
      // Don't handle CRASHED here - let the dedicated useEffect handle it
      // This prevents conflicts
      return;
    } else {
      // Pause video for READY state (show static image instead)
      video.pause();
    }
    
    const handleTimeUpdate = () => {
      // This creates the seamless looping effect while the game is running
      // Play the full video once, then loop from 2 seconds onwards (skipping first 2 seconds)
      if (gameState === 'DIPPING' && video.readyState >= 2) {
        // Get video duration
        const duration = video.duration;
        // If video has reached the end, loop from 2 seconds (skipping first 2 seconds)
        if (duration > 0 && video.currentTime >= duration - 0.1) {
          video.currentTime = 2.0;
          // Ensure video continues playing after seeking
          if (video.paused) {
            video.play().catch(console.error);
          }
        }
      }
    };
    
    if (gameState === 'DIPPING') {
    video.addEventListener('timeupdate', handleTimeUpdate);
      // Ensure video is playing
      if (video.paused && video.readyState >= 2) {
        video.play().catch(console.error);
      }
    }
    
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [gameState]);

  useEffect(() => {
    const successVideo = successVideoRef.current;
    if (successVideo) {
      // Preload the success video so it's ready when needed
      successVideo.preload = 'auto';
      successVideo.load();
    }
  }, []);

  useEffect(() => {
    const successVideo = successVideoRef.current;
    if (gameState === 'CASHED_OUT' && successVideo) {
      // Reset playing state when cashing out
      setSuccessVideoPlaying(false);
      
      // Play success video from 4th second when cashing out - immediate playback
      successVideo.loop = false;
      
      // For mobile: ensure video is ready before making it visible
      const playSuccessVideo = () => {
        // For mobile: start from beginning to ensure playback, then seek
        successVideo.currentTime = 0;
        
        // Play first to ensure video starts
        const playPromise = successVideo.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            // Once playing, seek to 4.0 seconds (for mobile compatibility)
            const seekToTime = () => {
              if (successVideo.readyState >= 2) {
                successVideo.currentTime = 4.0;
                // Video is playing at correct time, now make it visible
                setSuccessVideoPlaying(true);
                if (successVideo.style) {
                  successVideo.style.opacity = '1';
                  successVideo.style.visibility = 'visible';
                }
              } else {
                // Wait a bit more for video to be ready
                setTimeout(seekToTime, 50);
              }
            };
            
            // Wait for video to be ready, then seek
            if (successVideo.readyState >= 2) {
              seekToTime();
            } else {
              successVideo.addEventListener('canplay', seekToTime, { once: true });
            }
          }).catch(error => {
            console.error('Error playing success video:', error);
            // Retry if play fails
            setTimeout(() => {
              successVideo.currentTime = 0;
              successVideo.play().then(() => {
                setTimeout(() => {
                  if (successVideo.readyState >= 2) {
                    successVideo.currentTime = 4.0;
                    if (successVideo.style) {
                      successVideo.style.opacity = '1';
                      successVideo.style.visibility = 'visible';
                    }
                  }
                }, 100);
              }).catch(console.error);
            }, 100);
          });
        }
      };
      
      // Force reload video for mobile (prevents static image after multiple plays)
      successVideo.load();
      
      // Small delay to ensure load() completes on mobile
      const loadTimer = setTimeout(() => {
        // If video is ready, play immediately
        if (successVideo.readyState >= 4) {
          // Video fully loaded
          playSuccessVideo();
        } else if (successVideo.readyState >= 2) {
          // Enough data to play
          playSuccessVideo();
        } else {
          // Wait for video to be ready
          const handleCanPlay = () => {
            playSuccessVideo();
            successVideo.removeEventListener('canplay', handleCanPlay);
            successVideo.removeEventListener('loadeddata', handleLoadedData);
            successVideo.removeEventListener('loadedmetadata', handleLoadedMetadata);
          };
          
          const handleLoadedData = () => {
            playSuccessVideo();
            successVideo.removeEventListener('canplay', handleCanPlay);
            successVideo.removeEventListener('loadeddata', handleLoadedData);
            successVideo.removeEventListener('loadedmetadata', handleLoadedMetadata);
          };
          
          const handleLoadedMetadata = () => {
            // Metadata loaded, try to play
            if (successVideo.readyState >= 2) {
              playSuccessVideo();
            }
            successVideo.removeEventListener('canplay', handleCanPlay);
            successVideo.removeEventListener('loadeddata', handleLoadedData);
            successVideo.removeEventListener('loadedmetadata', handleLoadedMetadata);
          };
          
          successVideo.addEventListener('canplay', handleCanPlay);
          successVideo.addEventListener('loadeddata', handleLoadedData);
          successVideo.addEventListener('loadedmetadata', handleLoadedMetadata);
        }
      }, 50);
      
      return () => {
        clearTimeout(loadTimer);
      };
    } else {
      // Reset when not cashing out - ensure video is reset
      setSuccessVideoPlaying(false);
      const successVid = successVideoRef.current;
      if (successVid && gameState !== 'CASHED_OUT') {
        successVid.pause();
        successVid.currentTime = 0;
      }
    }
  }, [gameState]);
        // Wait for video to be ready - critical for mobile
        const handleCanPlay = () => {
          playSuccessVideo();
          successVideo.removeEventListener('canplay', handleCanPlay);
          successVideo.removeEventListener('loadeddata', handleLoadedData);
          successVideo.removeEventListener('loadedmetadata', handleLoadedMetadata);
        };
        
        const handleLoadedData = () => {
          playSuccessVideo();
          successVideo.removeEventListener('canplay', handleCanPlay);
          successVideo.removeEventListener('loadeddata', handleLoadedData);
          successVideo.removeEventListener('loadedmetadata', handleLoadedMetadata);
        };
        
        const handleLoadedMetadata = () => {
          // Metadata loaded, try to play
          if (successVideo.readyState >= 2) {
            playSuccessVideo();
          }
          successVideo.removeEventListener('canplay', handleCanPlay);
          successVideo.removeEventListener('loadeddata', handleLoadedData);
          successVideo.removeEventListener('loadedmetadata', handleLoadedMetadata);
        };
        
        successVideo.addEventListener('canplay', handleCanPlay);
        successVideo.addEventListener('loadeddata', handleLoadedData);
        successVideo.addEventListener('loadedmetadata', handleLoadedMetadata);
        
        return () => {
          successVideo.removeEventListener('canplay', handleCanPlay);
          successVideo.removeEventListener('loadeddata', handleLoadedData);
          successVideo.removeEventListener('loadedmetadata', handleLoadedMetadata);
        };
      }
    } else {
      // Reset when not cashing out
      setSuccessVideoPlaying(false);
    }
  }, [gameState]);

  const startDip = () => {
    if (!socket || !socket.connected) {
      console.error('Socket not connected! Cannot start game.');
      alert('Cannot connect to server. Make sure the backend server is running on port 3001.');
      return;
    }
    console.log('Starting game with stake:', stake);
    setGameState('DIPPING');
    socket.emit('start_game', { stake });
  };

  const cashOut = () => {
    if (gameState === 'DIPPING' && socket && socket.connected) {
      console.log('Cashing out...');
      socket.emit('cash_out');
    } else {
      console.error('Cannot cash out - gameState:', gameState, 'socket connected:', socket?.connected);
    }
  };

  const tryAgain = () => {
    // Reset all videos when returning to READY
    const crashVideo = crashVideoElementRef.current;
    const successVid = successVideoRef.current;
    const dippingVid = dippingVideoRef.current;
    
    if (crashVideo) {
      crashVideo.pause();
      crashVideo.currentTime = 0;
      crashVideo.load();
    }
    if (successVid) {
      successVid.pause();
      successVid.currentTime = 0;
      successVid.load();
    }
    if (dippingVid) {
      dippingVid.pause();
      dippingVid.currentTime = 0;
    }
    
    setGameState('READY');
    setMultiplier(1.00);
    setShowTryAgain(false);
    setSuccessVideoPlaying(false);
  };

  // Auto cashout when multiplier reaches auto cashout point
  useEffect(() => {
    if (autoPlay && gameState === 'DIPPING' && multiplier >= autoBetCashout && socket) {
      socket.emit('cash_out');
    }
  }, [multiplier, autoPlay, gameState, autoBetCashout, socket]);

  // Auto start rounds when auto bet is enabled
  useEffect(() => {
    if (autoPlay && gameState === 'READY' && autoBetRoundsRemaining > 0 && socket) {
      // Wait a moment then start the round
      const timer = setTimeout(() => {
        setGameState('DIPPING');
        socket.emit('start_game', { stake: autoBetStake });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoPlay, gameState, autoBetRoundsRemaining, autoBetStake, socket]);

  // Handle round completion and start next round if auto bet is active
  useEffect(() => {
    if (autoPlay && autoBetRoundsRemaining > 0) {
      if (gameState === 'CRASHED' || gameState === 'CASHED_OUT') {
        const currentRounds = autoBetRoundsRemaining;
        const newRounds = currentRounds - 1;
        
        // Wait 3 seconds after round ends, then handle next round
        const timer = setTimeout(() => {
          if (newRounds <= 0) {
            // Disable auto bet when rounds are complete
            setAutoPlay(false);
            setAutoBetRoundsRemaining(0);
            setGameState('READY');
            setMultiplier(1.00);
            setShowTryAgain(false);
          } else {
            // Decrement rounds and reset to READY (which will trigger auto start for next round)
            setAutoBetRoundsRemaining(newRounds);
            setGameState('READY');
            setMultiplier(1.00);
            setShowTryAgain(false);
          }
        }, 3000); // Wait 3 seconds after round ends
        
        return () => clearTimeout(timer);
      }
    }
  }, [gameState, autoPlay, autoBetRoundsRemaining]);

  return (
    <>
      <style>{`
        @keyframes bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        @keyframes icy-twinkle {
          0%, 100% { 
            text-shadow: 
              0 0 8px rgba(255,255,255,1),
              0 0 15px rgba(0,245,255,1),
              0 0 20px rgba(255,20,147,0.9),
              0 0 25px rgba(0,245,255,0.8),
              0 0 35px rgba(255,20,147,0.7),
              -2px -2px 0px rgba(0,245,255,1),
              2px 2px 0px rgba(255,20,147,1),
              -1px 1px 0px rgba(0,245,255,0.9);
          }
          50% { 
            text-shadow: 
              0 0 12px rgba(255,255,255,1),
              0 0 25px rgba(0,245,255,1),
              0 0 30px rgba(255,20,147,1),
              0 0 35px rgba(0,245,255,0.9),
              0 0 45px rgba(255,20,147,0.8),
              -3px -3px 0px rgba(0,245,255,1),
              3px 3px 0px rgba(255,20,147,1),
              -2px 2px 0px rgba(0,245,255,1);
          }
        }
        @keyframes snowfall {
          0% {
            transform: translateY(0) translateX(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) translateX(20px) rotate(360deg);
            opacity: 0.3;
          }
        }
        @keyframes scribble {
          0% {
            opacity: 0;
            transform: scale(0.5) rotate(-5deg);
          }
          50% {
            transform: scale(1.1) rotate(2deg);
          }
          100% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
        }
        @keyframes shimmer {
          0%, 100% {
            opacity: 1;
            transform: translate(50%, -50%) scale(1);
            box-shadow: 0 0 clamp(0.2rem, 0.6vw, 0.4rem) #87ceeb, 0 0 clamp(0.4rem, 1.2vw, 0.8rem) rgba(135, 206, 235, 0.6), inset 0 0 clamp(0.3rem, 0.9vw, 0.6rem) rgba(255, 255, 255, 0.8);
          }
          50% {
            opacity: 0.9;
            transform: translate(50%, -50%) scale(1.1);
            box-shadow: 0 0 clamp(0.3rem, 0.9vw, 0.6rem) #87ceeb, 0 0 clamp(0.6rem, 1.8vw, 1.2rem) rgba(135, 206, 235, 0.8), inset 0 0 clamp(0.4rem, 1.2vw, 0.8rem) rgba(255, 255, 255, 1);
          }
        }
        .icicle-text {
          animation: icy-twinkle 2s ease-in-out infinite;
          letter-spacing: 0.15em;
          -webkit-text-stroke: 2px rgba(0,245,255,0.9);
          text-stroke: 2px rgba(0,245,255,0.9);
        }
        * {
          box-sizing: border-box;
        }
        html, body {
          margin: 0;
          padding: 0;
          height: 100%;
          height: 100dvh;
          overflow: hidden;
        }
        /* Small phones (iPhone SE, small Android) - < 375px */
        @media (max-width: 374px) {
          .game-button {
            fontStyle: italic !important;
            fontWeight: 900 !important;
          }
          .icicle-text {
            font-size: clamp(1.2rem, 4vw, 1.5rem) !important;
          }
          .controls-container {
            padding: clamp(0.5rem, 1.5vw, 0.75rem) !important;
            gap: clamp(0.4rem, 1.2vw, 0.6rem) !important;
          }
          .bear-container {
            padding: 0 !important;
          }
        }
        /* Regular phones (iPhone 12/13/14, standard Android) - 375px - 428px */
        @media (min-width: 375px) and (max-width: 428px) {
          .game-button {
            fontStyle: italic !important;
            fontWeight: 900 !important;
          }
          .icicle-text {
            font-size: clamp(1.5rem, 5vw, 2rem) !important;
          }
        }
        /* Large phones (iPhone Pro Max, large Android) - 428px - 767px */
        @media (min-width: 428px) and (max-width: 767px) {
          .game-button {
            fontStyle: italic !important;
            fontWeight: 900 !important;
          }
          .icicle-text {
            font-size: clamp(1.8rem, 5.5vw, 2.5rem) !important;
          }
        }
        /* Mobile general - max 767px */
        @media (max-width: 767px) {
          .game-button {
            fontStyle: italic !important;
            fontWeight: 900 !important;
          }
          .controls-container button {
            border: none !important;
            border-bottom: none !important;
            border-left: none !important;
            border-right: none !important;
            box-shadow: none !important;
          }
          .bear-container {
            padding: 0 !important;
          }
          .bear-container img,
          .bear-container video {
            object-fit: cover !important;
          }
        }
        /* Tablets/iPads Portrait - 768px - 834px */
        @media (min-width: 768px) and (max-width: 834px) {
          .game-wrapper {
            width: 100% !important;
            max-width: 100% !important;
          }
          .bear-container {
            width: 100% !important;
            max-width: 100% !important;
          }
          .controls-container {
            width: 100% !important;
            max-width: 100% !important;
          }
          .icicle-text {
            font-size: clamp(2rem, 4vw, 2.5rem) !important;
          }
        }
        /* Tablets/iPads Landscape - 834px - 1024px */
        @media (min-width: 834px) and (max-width: 1024px) {
          .game-wrapper {
            width: 900px !important;
            max-width: 900px !important;
          }
          .bear-container {
            width: 100% !important;
            max-width: 100% !important;
          }
          .controls-container {
            width: 900px !important;
            max-width: 900px !important;
          }
          .icicle-text {
            font-size: clamp(2.2rem, 3.5vw, 2.8rem) !important;
          }
        }
        /* Small desktops/laptops - 1024px - 1440px */
        @media (min-width: 1024px) and (max-width: 1440px) {
          .game-wrapper {
            width: 900px !important;
            max-width: 900px !important;
          }
          .bear-container {
            width: 100% !important;
            max-width: 100% !important;
          }
          .controls-container {
            width: 900px !important;
            max-width: 900px !important;
          }
        }
        /* Large desktops - > 1440px */
        @media (min-width: 1441px) {
          .game-wrapper {
            width: 1000px !important;
            max-width: 1000px !important;
          }
          .bear-container {
            width: 100% !important;
            max-width: 100% !important;
          }
          .controls-container {
            width: 1000px !important;
            max-width: 1000px !important;
          }
          .icicle-text {
            font-size: clamp(2.5rem, 3vw, 3.5rem) !important;
          }
        }
        /* Desktop general - min 768px */
        @media (min-width: 768px) {
          .main-container {
            background: transparent !important;
          }
          .game-wrapper {
            width: auto !important;
            max-width: none !important;
            margin: 0 auto !important;
            display: flex !important;
            flex-direction: column !important;
            height: 100% !important;
            align-items: center !important;
          }
          .bear-container {
            flex: 1 !important;
            min-height: 0 !important;
            max-height: none !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            margin-top: 0 !important;
            background-color: transparent !important;
            box-shadow: none !important;
            padding: 0 !important;
            display: flex !important;
            align-items: stretch !important;
            justify-content: center !important;
            overflow: visible !important;
          }
          .bear-container img,
          .bear-container video {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
            display: block !important;
          }
          .controls-container {
            height: auto !important;
            max-height: none !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            margin-top: 0 !important;
            border-radius: 0 !important;
            background-color: transparent !important;
            padding: clamp(0.3rem, 0.8vw, 0.5rem) !important;
            transform: translateX(calc(11.5% + 7cm)) !important;
          }
          .controls-container .stake-row {
            width: 95% !important;
            gap: clamp(0.2rem, 0.5vw, 0.4rem) !important;
            margin: 0 auto !important;
          }
          .controls-container button.game-button {
            font-size: clamp(1.00rem, 2.93vw, 1.17rem) !important;
            padding: 0 !important;
            height: clamp(2.93rem, 6.7vw, 3.35rem) !important;
          }
          .controls-container button.dip-button {
            font-size: clamp(1.00rem, 2.93vw, 1.17rem) !important;
            padding: 0 !important;
            height: clamp(2.93rem, 6.7vw, 3.35rem) !important;
          }
          .controls-container button.auto-bet-button {
            font-size: clamp(1.00rem, 2.93vw, 1.17rem) !important;
            padding: 0 !important;
            height: clamp(2.93rem, 6.7vw, 3.35rem) !important;
            min-width: auto !important;
            max-width: none !important;
            flex: 0 0 auto !important;
          }
          .controls-container button {
            border: 1px solid #ff1493 !important;
            border-bottom: 1px solid #ff1493 !important;
            border-left: 1px solid #ff1493 !important;
            border-right: 1px solid #ff1493 !important;
            box-shadow: 0 2px 0 #87ceeb, 2px 0 0 #87ceeb, -2px 0 0 #87ceeb !important;
            height: clamp(2.93rem, 6.7vw, 3.35rem) !important;
            font-size: clamp(1.00rem, 2.93vw, 1.17rem) !important;
            color: #ffffff !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          .controls-container input {
            border: 1px solid #ff1493 !important;
            font-size: clamp(1.00rem, 2.93vw, 1.17rem) !important;
          }
          .controls-container div[style*="border"] {
            height: clamp(2.93rem, 6.7vw, 3.35rem) !important;
          }
          .controls-container span {
            font-size: clamp(1.00rem, 2.93vw, 1.17rem) !important;
          }
        }
        @media (max-width: 767px) {
          .controls-container button {
            border: 1px solid #ff1493 !important;
            border-bottom: 1px solid #ff1493 !important;
            border-left: 1px solid #ff1493 !important;
            border-right: 1px solid #ff1493 !important;
            box-shadow: none !important;
          }
          .controls-container input {
            border: 1px solid #ff1493 !important;
          }
          .bear-container video {
            transition: all 0.3s ease-out !important;
          }
          .bear-container.crashed-desktop video {
            width: 90% !important;
            height: 90% !important;
            left: 5% !important;
            right: 5% !important;
            top: 5% !important;
            bottom: 5% !important;
          }
          .bear-container video[data-crashed="true"] {
            width: 90% !important;
            height: 90% !important;
            left: 5% !important;
            right: 5% !important;
            top: 5% !important;
            bottom: 5% !important;
          }
        }
        @media (max-width: 767px) {
          .bear-container {
            padding: 0 !important;
          }
          .bear-container img,
          .bear-container video {
            object-fit: cover !important;
          }
        }
      `}</style>
      <div className="main-container" style={{ 
        height: '100dvh', 
        width: '100dvw',
        color: 'white', 
        display: 'flex', 
        flexDirection: 'column', 
        fontFamily: 'sans-serif',
        background: isDesktop ? 'transparent' : '#c0c0c0',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        padding: 0,
        margin: 0
      }}>
        {/* Hamburger Menu Icon - Top Right (Mobile only, desktop is inside bear-container) */}
        {!isDesktop && (
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              position: 'absolute',
              top: 'calc(clamp(0.75rem, 2vw, 1rem) - 0.25cm)',
              right: 'clamp(0.25rem, 1vw, 0.5rem)',
              zIndex: 10,
              backgroundColor: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid #ff1493',
              borderRadius: '8px',
              padding: 'clamp(0.5rem, 1.5vw, 0.75rem)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 'clamp(2.5rem, 6vw, 3rem)',
              height: 'clamp(2.5rem, 6vw, 3rem)',
              boxShadow: 'inset 0 2px 4px rgba(192,192,192,0.3), 0 0 8px rgba(37,99,235,0.4)'
            }}
            aria-label="Menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        )}

      {/* Snowy overlay effect - hidden on desktop */}
      {!isDesktop && (
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: '#c0c0c0',
          backgroundImage: `
            radial-gradient(circle at 20% 50%, rgba(255,255,255,0.8) 1px, transparent 1px),
            radial-gradient(circle at 40% 80%, rgba(255,255,255,0.6) 1px, transparent 1px),
            radial-gradient(circle at 60% 30%, rgba(255,255,255,0.7) 1px, transparent 1px),
            radial-gradient(circle at 80% 60%, rgba(255,255,255,0.5) 1px, transparent 1px),
            radial-gradient(circle at 30% 70%, rgba(255,255,255,0.9) 1px, transparent 1px)
          `,
          backgroundSize: '200px 200px, 150px 150px, 180px 180px, 160px 160px, 170px 170px',
          backgroundPosition: '0 0, 50px 50px, 100px 100px, 150px 150px, 200px 200px',
          pointerEvents: 'none',
          opacity: 1,
          zIndex: 0
        }} />
      )}
      
      {/* GAME WRAPPER - Constrains width on desktop */}
      <div className="game-wrapper" style={{
        width: isDesktop ? undefined : '100%',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
        backgroundColor: 'transparent',
        margin: isDesktop ? '0 auto' : '0',
        alignItems: isDesktop ? 'center' : 'stretch'
      }}>
        {/* GAME TITLE - In snowy background at top */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          textAlign: 'center',
          paddingTop: isDesktop ? '0' : 'clamp(0.5rem, 2vw, 1rem)',
          paddingBottom: isDesktop ? '0' : 'clamp(0.25rem, 1vw, 0.5rem)',
          width: '100%',
          marginTop: isDesktop ? '0' : 'auto'
        }}>
          {/* Balance Display - Top Left on mobile, below game name on desktop */}
          <div style={{
            position: 'absolute',
            left: isDesktop ? 'clamp(0.5rem, 1.5vw, 1rem)' : 'clamp(0.25rem, 1vw, 0.5rem)',
            top: isDesktop ? 'calc(100% + clamp(0.5rem, 1.5vw, 1rem))' : '50%',
            transform: isDesktop ? 'none' : 'translateY(-50%)',
            fontSize: 'clamp(0.875rem, 2.5vw, 1.25rem)',
            fontWeight: '700',
            color: '#ffffff',
            background: 'linear-gradient(135deg, #40e0d0 0%, #00b8d4 100%)',
            padding: 'clamp(0.25rem, 0.75vw, 0.5rem) clamp(0.35rem, 1vw, 0.7rem)',
            borderRadius: '8px',
            textRendering: 'optimizeLegibility',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            whiteSpace: 'nowrap',
            border: '1px solid #ff1493',
            zIndex: 3
          }}>
            {balance.toLocaleString()}szl
          </div>
          <h1 className="icicle-text" style={{
            fontSize: 'clamp(1.5rem, 5vw, 3rem)',
            fontWeight: '900',
            fontStyle: 'italic',
            background: 'linear-gradient(135deg, #00f5ff 0%, #ff1493 50%, #00f5ff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            margin: 0,
            marginLeft: '0.5cm',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            filter: 'drop-shadow(0 0 5px rgba(0,245,255,1)) drop-shadow(0 0 10px rgba(255,20,147,0.9)) drop-shadow(0 0 15px rgba(0,245,255,0.8))',
            lineHeight: '1.2',
            padding: '0.2em 0',
            textRendering: 'optimizeLegibility',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale'
          }}>
            <span style={{ display: 'inline-block' }}>POLAR</span>
            <span style={{ display: 'inline-block' }}>CRASH</span>
          </h1>
        </div>

        {/* BEAR VIDEO/IMAGE DISPLAY - Stretched to top and down to controls */}
        <div className="bear-container" style={{ 
        position: 'relative', 
        width: isDesktop ? 'auto' : '100%',
        flex: '1',
        minHeight: 0,
        maxWidth: isDesktop ? 'none' : '900px',
        margin: '0 auto',
        backgroundColor: isDesktop ? 'transparent' : 'rgba(15, 23, 42, 0.85)', 
        borderRadius: '0', 
        overflow: isDesktop ? 'visible' : 'hidden', 
        boxShadow: 'none',
        zIndex: 1,
        display: 'flex',
        alignItems: isDesktop ? 'flex-end' : 'center',
        justifyContent: 'center',
        padding: '0',
        marginTop: isDesktop ? 'clamp(4.5rem, 8.5vw, 6.5rem)' : '0',
        paddingBottom: isDesktop ? 'clamp(2rem, 4vw, 3rem)' : '0',
        minHeight: isDesktop ? 'clamp(30rem, 50vw, 40rem)' : 'auto',
        boxSizing: 'border-box'
      }}>
        {/* Hamburger Menu Icon - Inside bear-container (Desktop only) */}
        {isDesktop && (
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              position: 'absolute',
              top: 'clamp(0.5rem, 1.5vw, 1rem)',
              right: 'clamp(0.5rem, 1.5vw, 1rem)',
              zIndex: 10,
              backgroundColor: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid #ff1493',
              borderRadius: '8px',
              padding: 'clamp(0.5rem, 1.5vw, 0.75rem)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 'clamp(2.5rem, 6vw, 3rem)',
              height: 'clamp(2.5rem, 6vw, 3rem)',
              boxShadow: '0 0 8px rgba(255, 20, 147, 0.4), inset 0 2px 4px rgba(192,192,192,0.3)'
            }}
            aria-label="Menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        )}
        {/* Show launch video when READY */}
        {gameState === 'READY' && (
          <>
        <video 
              src={bearGameLaunch}
          autoPlay 
          loop 
              muted={!soundEnabled}
          playsInline 
              style={{ 
                width: isDesktop ? '77%' : '100%', 
                height: isDesktop ? '77%' : '100%', 
                objectFit: isDesktop ? 'contain' : 'cover',
                display: 'block',
                position: 'absolute',
                left: isDesktop ? '50%' : '0',
                right: isDesktop ? 'auto' : '0',
                top: isDesktop ? 'auto' : '0',
                bottom: isDesktop ? '0' : 'auto',
                transform: isDesktop ? 'translateX(calc(-50% + 7cm))' : 'none'
              }}
            />
            
            {/* Falling Snow on Static Image */}
            <div style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 2,
              overflow: 'hidden'
            }}>
              {[...Array(80)].map((_, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `${(i * 3.2) % 100}%`,
                    top: `${-10 - (i * 2) % 25}%`,
                    width: `${3 + (i % 4)}px`,
                    height: `${3 + (i % 4)}px`,
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    borderRadius: '50%',
                    animation: `snowfall ${8 + (i % 12)}s linear infinite`,
                    animationDelay: `${(i * 0.2) % 6}s`,
                    boxShadow: `
                      ${1 + (i % 2)}px ${1 + (i % 2)}px 2px rgba(255,255,255,0.6),
                      ${-1 - (i % 2)}px ${1 + (i % 2)}px 1px rgba(255,255,255,0.4)
                    `
                  }}
                />
              ))}
            </div>

            {/* Info Icon on White Coffee Cup - Only show if not disabled */}
            {!dontShowInfoAgain && (
              <div
                style={{
                  position: 'absolute',
                  left: isDesktop ? '48%' : 'calc(46% + 1cm)',
                  top: isDesktop ? '58%' : 'calc(56% + 3cm)',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 5,
                  cursor: 'pointer'
                }}
                onMouseEnter={() => {
                  if (!dontShowInfoAgain) {
                    setShowInfoTooltip(true);
                  }
                }}
                onMouseLeave={() => {
                  // Don't close on mouse leave if user is interacting with tooltip
                }}
                onClick={() => {
                  if (!dontShowInfoAgain) {
                    setShowInfoTooltip(!showInfoTooltip);
                  }
                }}
              >
                <div style={{
                  width: isDesktop ? 'clamp(2rem, 5vw, 2.5rem)' : 'clamp(1.75rem, 6vw, 2.25rem)',
                  height: isDesktop ? 'clamp(2rem, 5vw, 2.5rem)' : 'clamp(1.75rem, 6vw, 2.25rem)',
                  borderRadius: '50%',
                  backgroundColor: 'transparent',
                  border: '2px solid #ff1493',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ff1493',
                  fontSize: isDesktop ? 'clamp(1.25rem, 3vw, 1.5rem)' : 'clamp(1rem, 4vw, 1.25rem)',
                  fontWeight: '900',
                  fontFamily: 'Arial, sans-serif',
                  boxShadow: '0 2px 8px rgba(255, 20, 147, 0.5), 0 0 12px rgba(255, 20, 147, 0.3)',
                  transition: 'all 0.2s ease',
                  transform: showInfoTooltip ? 'scale(1.1)' : 'scale(1)'
                }}>
                  i
                </div>

                {/* Tooltip with How to Play Summary */}
                {showInfoTooltip && (
                  <div 
                    style={{
                      position: 'absolute',
                      bottom: 'calc(100% + clamp(0.75rem, 2vw, 1rem))',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      border: '2px solid #ff1493',
                      borderRadius: '12px',
                      padding: 'clamp(0.75rem, 2vw, 1rem)',
                      minWidth: 'clamp(12rem, 30vw, 18rem)',
                      maxWidth: 'clamp(14rem, 35vw, 20rem)',
                      zIndex: 6,
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
                      pointerEvents: 'auto',
                      whiteSpace: 'normal'
                    }}
                    onMouseEnter={() => {
                      // Keep tooltip open when hovering over it
                    }}
                    onMouseLeave={() => {
                      setShowInfoTooltip(false);
                    }}
                  >
                    <div style={{
                      color: '#ffffff',
                      fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
                      lineHeight: '1.5',
                      textAlign: 'center',
                      fontWeight: '600',
                      marginBottom: 'clamp(0.75rem, 2vw, 1rem)'
                    }}>
                      <div style={{ marginBottom: '0.5rem' }}>
                        Cash out before the biscuit dissolves to win!
                      </div>
                      <div>
                        The longer you wait, the higher your multiplier.
                      </div>
                    </div>
                    
                    {/* Don't Show Again Checkbox */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      paddingTop: 'clamp(0.5rem, 1.5vw, 0.75rem)',
                      borderTop: '1px solid rgba(255, 20, 147, 0.3)',
                      cursor: 'pointer'
                    }}
                    onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={dontShowInfoAgain}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setDontShowInfoAgain(checked);
                          localStorage.setItem('dontShowInfoTooltip', checked.toString());
                          if (checked) {
                            setShowInfoTooltip(false);
                          }
                        }}
                        style={{
                          width: 'clamp(1rem, 2.5vw, 1.25rem)',
                          height: 'clamp(1rem, 2.5vw, 1.25rem)',
                          cursor: 'pointer',
                          accentColor: '#ff1493'
                        }}
                      />
                      <label style={{
                        color: '#ffffff',
                        fontSize: 'clamp(0.75rem, 2vw, 0.875rem)',
                        cursor: 'pointer',
                        userSelect: 'none'
                      }}>
                        Don't show this again
                      </label>
                    </div>
                    
                    {/* Tooltip Arrow */}
                    <div style={{
                      position: 'absolute',
                      bottom: '-8px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 0,
                      height: 0,
                      borderLeft: '8px solid transparent',
                      borderRight: '8px solid transparent',
                      borderTop: '8px solid #ff1493'
                    }} />
                  </div>
                )}
              </div>
            )}
          </>
        )}
        
        {/* Preload crash video to prevent blank flash */}
        <video 
          ref={crashVideoRef}
          preload="auto"
          style={{ display: 'none' }}
        >
          <source src={bearCrashVideo} type="video/mp4" />
        </video>

        {/* Show bear dipping video when DIPPING - hide immediately on CASHED_OUT */}
        <video 
          key="dipping-video"
          ref={(el) => {
            dippingVideoRef.current = el;
            videoRef.current = el; // Also set videoRef for compatibility
          }}
          playsInline 
          muted={!soundEnabled}
          preload="auto"
            style={{ 
              width: isDesktop ? '77%' : '100%', 
              height: isDesktop ? '77%' : '100%', 
              objectFit: isDesktop ? 'contain' : 'cover', 
              position: 'absolute', 
              left: isDesktop ? '50%' : '0',
              right: isDesktop ? 'auto' : '0',
              top: isDesktop ? 'auto' : '0',
              bottom: isDesktop ? '0' : 'auto',
              transform: isDesktop ? 'translateX(calc(-50% + 7cm))' : 'none',
              opacity: gameState === 'DIPPING' ? 1 : 0,
              transition: 'opacity 0s',
              pointerEvents: gameState === 'DIPPING' ? 'auto' : 'none',
              backgroundColor: 'transparent',
              zIndex: 1,
              display: gameState === 'DIPPING' || gameState === 'CRASHED' ? 'block' : 'none',
              visibility: gameState === 'CASHED_OUT' ? 'hidden' : 'visible'
            }}
          >
            <source src={bearStartVideo} type="video/mp4" />
        </video>
        
        {/* Show bear crash video when CRASHED - overlay on top, fade in smoothly */}
        <video 
          key="crash-video"
          ref={crashVideoElementRef} 
          playsInline 
          muted={!soundEnabled}
          preload="auto"
          autoPlay
            data-crashed={isDesktop ? 'true' : 'false'}
            style={{ 
              width: isDesktop ? '77%' : '100%', 
              height: isDesktop ? '77%' : '100%', 
              objectFit: isDesktop ? 'contain' : 'cover', 
              position: 'absolute', 
              left: isDesktop ? '50%' : '0',
              right: isDesktop ? 'auto' : '0',
              top: isDesktop ? 'auto' : '0',
              bottom: isDesktop ? '0' : 'auto',
              transform: isDesktop ? 'translateX(calc(-50% + 7cm))' : 'none',
              opacity: gameState === 'CRASHED' ? 1 : 0,
              transition: isDesktop ? 'all 0.3s ease-out' : 'opacity 0.3s ease-in',
              pointerEvents: gameState === 'CRASHED' ? 'auto' : 'none',
              backgroundColor: 'transparent',
              zIndex: 2,
              display: gameState === 'CRASHED' ? 'block' : 'none'
            }}
          >
            <source src={bearCrashVideo} type="video/mp4" />
        </video>
        
        {/* Preload success video to prevent static image flash */}
        <video 
          ref={successVideoPreloadRef}
          preload="auto"
          style={{ display: 'none' }}
        >
          <source src={successVideo} type="video/mp4" />
        </video>
        
        {/* Show success video when CASHED_OUT - always render but control visibility */}
        <video 
          key="success" 
          ref={successVideoRef} 
          playsInline 
          muted={!soundEnabled}
          preload="auto"
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: isDesktop ? 'cover' : 'contain',
            position: 'absolute',
            inset: 0,
            display: 'block',
            opacity: gameState === 'CASHED_OUT' ? 1 : 0,
            transition: 'opacity 0s',
            pointerEvents: gameState === 'CASHED_OUT' ? 'auto' : 'none',
            zIndex: gameState === 'CASHED_OUT' ? 3 : 1,
            backgroundColor: 'transparent',
            visibility: gameState === 'CASHED_OUT' ? 'visible' : 'hidden'
          }}
        >
          <source src={successVideo} type="video/mp4" />
        </video>

        {/* OVERLAY */}
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'transparent', zIndex: 3 }}>

          {/* MULTIPLIER - Show during dipping, crash, and win - always white */}
          {(gameState === 'DIPPING' || gameState === 'CRASHED' || gameState === 'CASHED_OUT') && (
            <div style={{ position: 'absolute', bottom: gameState === 'CRASHED' || gameState === 'CASHED_OUT' ? (showTryAgain ? 'clamp(5rem, 15vw, 7rem)' : 'clamp(4rem, 12vw, 6rem)') : 'clamp(0.5rem, 2vw, 1rem)', left: 0, right: 0, textAlign: 'center' }}>
              <span style={{ 
                fontSize: 'clamp(1.25rem, 4vw, 2.5rem)', 
                fontWeight: '900', 
                fontStyle: 'italic', 
                color: 'white',
                textShadow: '0 2px 4px rgba(0,0,0,0.5)'
              }}>
            {multiplier.toFixed(2)}x
          </span>
        </div>
          )}
          
          {/* WINNING AMOUNT - Show during gameplay and when cashed out, top right */}
          {gameState === 'DIPPING' && (
            <div style={{ position: 'absolute', top: 'clamp(0.5rem, 2vw, 1rem)', right: 'clamp(0.5rem, 2vw, 1rem)', textAlign: 'right' }}>
              <div style={{ 
                backgroundColor: 'rgba(0,0,0,0.6)', 
                padding: 'clamp(0.5rem, 1.5vw, 0.75rem) clamp(0.75rem, 2vw, 1rem)',
                borderRadius: '12px',
                backdropFilter: 'blur(10px)'
              }}>
                <div style={{ fontSize: 'clamp(0.75rem, 2vw, 0.875rem)', color: '#cbd5e1', marginBottom: '0.25rem' }}>WINNING</div>
                <div style={{ 
                  fontSize: 'clamp(1rem, 3vw, 1.5rem)', 
                  fontWeight: '900', 
                  color: '#40e0d0',
                  textShadow: '0 0 8px rgba(64,224,208,0.8)'
                }}>
                  {(parseFloat(stake) * multiplier).toFixed(2)}
      </div>
              </div>
            </div>
          )}
          
          {/* WIN MESSAGE WITH AMOUNT - Show when cashed out, top right */}
          {gameState === 'CASHED_OUT' && (
            <div style={{ position: 'absolute', top: 'clamp(0.5rem, 2vw, 1rem)', right: 'clamp(0.5rem, 2vw, 1rem)', textAlign: 'right' }}>
              <div style={{ 
                backgroundColor: 'rgba(0,0,0,0.6)', 
                padding: 'clamp(0.5rem, 1.5vw, 0.75rem) clamp(0.75rem, 2vw, 1rem)',
                borderRadius: '12px',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                gap: 'clamp(0.5rem, 1.5vw, 0.75rem)'
              }}>
                <span style={{ 
                  fontSize: 'clamp(1.25rem, 3.5vw, 1.75rem)', 
                  fontWeight: '900', 
                  color: '#ff6b9d',
                  textRendering: 'optimizeLegibility',
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale',
                  animation: 'bounce 1s ease-in-out infinite'
                }}>
                  YOU WIN
                </span>
                <span style={{ 
                  fontSize: 'clamp(1rem, 3vw, 1.5rem)', 
                  fontWeight: '900', 
                  color: '#40e0d0',
                  textRendering: 'optimizeLegibility',
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale'
                }}>
                  {(parseFloat(stake) * multiplier).toFixed(2)}
                </span>
              </div>
            </div>
          )}
          
          {/* YOU LOSE MESSAGE - Top right when crashed - Desktop sequence */}
          {gameState === 'CRASHED' && (isDesktop ? showYouLose : true) && (
            <div style={{ position: 'absolute', top: 'clamp(0.5rem, 2vw, 1rem)', right: 'clamp(0.5rem, 2vw, 1rem)', textAlign: 'right' }}>
              <div style={{ 
                backgroundColor: 'rgba(0,0,0,0.6)', 
                padding: 'clamp(0.5rem, 1.5vw, 0.75rem) clamp(0.75rem, 2vw, 1rem)',
                borderRadius: '12px',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                gap: 'clamp(0.5rem, 1.5vw, 0.75rem)'
              }}>
                <span style={{ 
                  fontSize: 'clamp(1.25rem, 3.5vw, 1.75rem)', 
                  fontWeight: '900', 
                  color: '#ff6b9d',
                  textRendering: 'optimizeLegibility',
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale'
                }}>
                  YOU LOSE
                </span>
                <span style={{ 
                  fontSize: 'clamp(1rem, 3vw, 1.5rem)', 
                  fontWeight: '900', 
                  color: '#ffffff',
                  textRendering: 'optimizeLegibility',
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale'
                }}>
                  {multiplier.toFixed(2)}x
                </span>
              </div>
            </div>
          )}
          
          {/* CRASH MESSAGE - Bottom of frame when crashed - Show only once */}
          {gameState === 'CRASHED' && !showTryAgain && (
            <div style={{ position: 'absolute', bottom: 'clamp(0.5rem, 2vw, 1rem)', left: 0, right: 0, textAlign: 'center' }}>
              <span style={{ 
                fontSize: 'clamp(1.25rem, 4vw, 2rem)', 
                fontWeight: '900', 
                fontStyle: 'italic', 
                color: '#ff6b9d',
                textShadow: '0 2px 4px rgba(0,0,0,0.8), 0 4px 8px rgba(0,0,0,0.6)',
                textRendering: 'optimizeLegibility',
                WebkitFontSmoothing: 'antialiased',
                MozOsxFontSmoothing: 'grayscale'
              }}>
                Biscuit dissolved.
              </span>
            </div>
          )}
          
          {/* PLAY AGAIN / TRY AGAIN BUTTON - Show 2 seconds after crash or win */}
          {showTryAgain && (gameState === 'CRASHED' || gameState === 'CASHED_OUT') && (
            <div style={{ position: 'absolute', bottom: 'clamp(0.5rem, 2vw, 1rem)', left: 0, right: 0, textAlign: 'center' }}>
              <button
                onClick={tryAgain}
                className="icicle-text"
                style={{
                  background: 'linear-gradient(135deg, #00f5ff 0%, #ff1493 50%, #00f5ff 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
                  fontWeight: '900',
                  fontStyle: 'italic',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.5rem 1rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  filter: 'drop-shadow(0 0 5px rgba(0,245,255,1)) drop-shadow(0 0 10px rgba(255,20,147,0.9))',
                  backgroundColor: 'transparent',
                  outline: 'none'
                }}
              >
                {gameState === 'CASHED_OUT' ? 'PLAY AGAIN' : 'TRY AGAIN'}
              </button>
            </div>
          )}
        </div>
        
        {/* Crash History - At the very bottom of bear-container, starting from left */}
        {crashHistory.length > 0 && (
          <div style={{
            position: 'absolute',
            bottom: '0',
            left: '0',
            right: '0',
            width: '100%',
            padding: isDesktop ? 'clamp(0.3rem, 0.9vw, 0.45rem)' : 'clamp(0.5rem, 1.5vw, 0.75rem)',
            paddingLeft: 'clamp(0.5rem, 1.5vw, 1rem)',
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'nowrap',
            gap: 'clamp(0.5rem, 1.5vw, 0.75rem)',
            justifyContent: 'flex-start',
            alignItems: 'center',
            maxHeight: 'clamp(3rem, 8vw, 5rem)',
            overflowY: 'auto',
            overflowX: 'auto',
            zIndex: 2
          }}>
            {crashHistory.map((value, index) => (
              <span
                key={index}
                style={{
                  fontSize: isDesktop ? 'clamp(0.45rem, 1.2vw, 0.6rem)' : 'clamp(0.75rem, 2vw, 1rem)',
                  fontWeight: '700',
                  color: '#ffffff',
                  padding: isDesktop ? 'clamp(0.15rem, 0.45vw, 0.3rem) clamp(0.3rem, 0.9vw, 0.45rem)' : 'clamp(0.25rem, 0.75vw, 0.5rem) clamp(0.5rem, 1.5vw, 0.75rem)',
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  borderRadius: '8px',
                  textRendering: 'optimizeLegibility',
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale'
                }}
              >
                {value}x
              </span>
            ))}
          </div>
        )}

        {/* Menu Modal - Overlay on game block - Modern Style */}
        {menuOpen && (
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(2px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'clamp(1rem, 3vw, 2rem)',
            overflow: 'hidden',
            borderRadius: '0'
          }} onClick={() => setMenuOpen(false)}>
            <div style={{
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(10px)',
              borderRadius: '16px',
              padding: 'clamp(1.5rem, 4vw, 2.5rem)',
              maxWidth: isDesktop ? '400px' : '85%',
              width: '100%',
              border: '1px solid rgba(0, 245, 255, 0.3)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(0, 245, 255, 0.1), inset 0 0 20px rgba(0, 245, 255, 0.05)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: 'clamp(1rem, 2.5vw, 1.5rem)',
              zIndex: 102
            }} onClick={(e) => e.stopPropagation()}>
              {/* Close Button - Top Right Corner */}
              <button
                onClick={() => setMenuOpen(false)}
                style={{
                  position: 'absolute',
                  top: 'clamp(0.5rem, 1.5vw, 0.75rem)',
                  right: 'clamp(0.5rem, 1.5vw, 0.75rem)',
                  background: 'transparent',
                  border: '1px solid rgba(0, 245, 255, 0.5)',
                  borderRadius: '6px',
                  color: '#00f5ff',
                  fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
                  width: 'clamp(1.75rem, 4vw, 2rem)',
                  height: 'clamp(1.75rem, 4vw, 2rem)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 0 8px rgba(0, 245, 255, 0.3)',
                  zIndex: 103
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 245, 255, 0.5)';
                  e.currentTarget.style.borderColor = '#00f5ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 0 8px rgba(0, 245, 255, 0.3)';
                  e.currentTarget.style.borderColor = 'rgba(0, 245, 255, 0.5)';
                }}
                aria-label="Close menu"
              >
                ×
              </button>

              {/* Scrollable Menu Content */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'clamp(1rem, 2.5vw, 1.5rem)',
                overflowY: 'auto',
                overflowX: 'hidden',
                maxHeight: 'calc(90vh - clamp(3rem, 8vw, 4rem))',
                WebkitOverflowScrolling: 'touch',
                paddingRight: '0.5rem',
                marginRight: '-0.5rem'
              }}>
              {/* Sound Toggle */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'clamp(0.75rem, 2vw, 1rem)',
                background: 'rgba(0, 245, 255, 0.05)',
                border: '1px solid rgba(0, 245, 255, 0.2)',
                borderRadius: '12px',
                boxShadow: '0 0 12px rgba(0, 245, 255, 0.1), inset 0 0 8px rgba(0, 245, 255, 0.05)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00f5ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 4px rgba(0, 245, 255, 0.6))' }}>
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                  </svg>
                  <span style={{
                    color: '#ffffff',
                    fontSize: 'clamp(0.875rem, 2.2vw, 1rem)',
                    fontWeight: '600'
                  }}>Sound</span>
                </div>
                <div
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  style={{
                    width: 'clamp(3rem, 7vw, 3.5rem)',
                    height: 'clamp(1.5rem, 3.5vw, 1.75rem)',
                    borderRadius: '999px',
                    background: soundEnabled ? '#ff1493' : 'rgba(100, 100, 100, 0.5)',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: soundEnabled ? '0 0 12px rgba(255, 20, 147, 0.5), inset 0 0 8px rgba(255, 20, 147, 0.2)' : 'inset 0 0 8px rgba(0, 0, 0, 0.3)'
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    top: '2px',
                    left: soundEnabled ? 'calc(100% - clamp(1.25rem, 3vw, 1.5rem) - 2px)' : '2px',
                    width: 'clamp(1.25rem, 3vw, 1.5rem)',
                    height: 'clamp(1.25rem, 3vw, 1.5rem)',
                    borderRadius: '50%',
                    background: '#ffffff',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
                  }} />
                </div>
              </div>

              {/* How to Play Section */}
              <div
                onClick={() => setActiveMenuSection(activeMenuSection === 'How to Play' ? null : 'How to Play')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: 'clamp(0.75rem, 2vw, 1rem)',
                  background: activeMenuSection === 'How to Play' ? 'rgba(0, 245, 255, 0.1)' : 'rgba(0, 245, 255, 0.05)',
                  border: '1px solid rgba(0, 245, 255, 0.2)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: activeMenuSection === 'How to Play' ? '0 0 16px rgba(0, 245, 255, 0.2), inset 0 0 12px rgba(0, 245, 255, 0.1)' : '0 0 12px rgba(0, 245, 255, 0.1), inset 0 0 8px rgba(0, 245, 255, 0.05)'
                }}
                onMouseEnter={(e) => {
                  if (activeMenuSection !== 'How to Play') {
                    e.currentTarget.style.background = 'rgba(0, 245, 255, 0.08)';
                    e.currentTarget.style.boxShadow = '0 0 14px rgba(0, 245, 255, 0.15), inset 0 0 10px rgba(0, 245, 255, 0.08)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeMenuSection !== 'How to Play') {
                    e.currentTarget.style.background = 'rgba(0, 245, 255, 0.05)';
                    e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 245, 255, 0.1), inset 0 0 8px rgba(0, 245, 255, 0.05)';
                  }
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00f5ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 4px rgba(0, 245, 255, 0.6))' }}>
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M12 16v-4M12 8h.01"></path>
                </svg>
                <span style={{
                  color: '#ffffff',
                  fontSize: 'clamp(0.875rem, 2.2vw, 1rem)',
                  fontWeight: '600'
                }}>How to Play</span>
              </div>

              {/* Bet History Section */}
              <div
                onClick={() => setActiveMenuSection(activeMenuSection === 'Bet History' ? null : 'Bet History')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: 'clamp(0.75rem, 2vw, 1rem)',
                  background: activeMenuSection === 'Bet History' ? 'rgba(0, 245, 255, 0.1)' : 'rgba(0, 245, 255, 0.05)',
                  border: '1px solid rgba(0, 245, 255, 0.2)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: activeMenuSection === 'Bet History' ? '0 0 16px rgba(0, 245, 255, 0.2), inset 0 0 12px rgba(0, 245, 255, 0.1)' : '0 0 12px rgba(0, 245, 255, 0.1), inset 0 0 8px rgba(0, 245, 255, 0.05)'
                }}
                onMouseEnter={(e) => {
                  if (activeMenuSection !== 'Bet History') {
                    e.currentTarget.style.background = 'rgba(0, 245, 255, 0.08)';
                    e.currentTarget.style.boxShadow = '0 0 14px rgba(0, 245, 255, 0.15), inset 0 0 10px rgba(0, 245, 255, 0.08)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeMenuSection !== 'Bet History') {
                    e.currentTarget.style.background = 'rgba(0, 245, 255, 0.05)';
                    e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 245, 255, 0.1), inset 0 0 8px rgba(0, 245, 255, 0.05)';
                  }
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00f5ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 4px rgba(0, 245, 255, 0.6))' }}>
                  <line x1="12" y1="20" x2="12" y2="10"></line>
                  <line x1="18" y1="20" x2="18" y2="4"></line>
                  <line x1="6" y1="20" x2="6" y2="16"></line>
                </svg>
                <span style={{
                  color: '#ffffff',
                  fontSize: 'clamp(0.875rem, 2.2vw, 1rem)',
                  fontWeight: '600'
                }}>Bet History</span>
              </div>

              {/* Rules Section */}
              <div
                onClick={() => setActiveMenuSection(activeMenuSection === 'Rules' ? null : 'Rules')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: 'clamp(0.75rem, 2vw, 1rem)',
                  background: activeMenuSection === 'Rules' ? 'rgba(0, 245, 255, 0.1)' : 'rgba(0, 245, 255, 0.05)',
                  border: '1px solid rgba(0, 245, 255, 0.2)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: activeMenuSection === 'Rules' ? '0 0 16px rgba(0, 245, 255, 0.2), inset 0 0 12px rgba(0, 245, 255, 0.1)' : '0 0 12px rgba(0, 245, 255, 0.1), inset 0 0 8px rgba(0, 245, 255, 0.05)'
                }}
                onMouseEnter={(e) => {
                  if (activeMenuSection !== 'Rules') {
                    e.currentTarget.style.background = 'rgba(0, 245, 255, 0.08)';
                    e.currentTarget.style.boxShadow = '0 0 14px rgba(0, 245, 255, 0.15), inset 0 0 10px rgba(0, 245, 255, 0.08)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeMenuSection !== 'Rules') {
                    e.currentTarget.style.background = 'rgba(0, 245, 255, 0.05)';
                    e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 245, 255, 0.1), inset 0 0 8px rgba(0, 245, 255, 0.05)';
                  }
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00f5ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 4px rgba(0, 245, 255, 0.6))' }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                <span style={{
                  color: '#ffffff',
                  fontSize: 'clamp(0.875rem, 2.2vw, 1rem)',
                  fontWeight: '600'
                }}>Rules</span>
              </div>

              {/* Expanded How to Play Content */}
              {activeMenuSection === 'How to Play' && (
                <div style={{
                  padding: 'clamp(0.75rem, 2vw, 1rem)',
                  background: 'rgba(0, 245, 255, 0.05)',
                  border: '1px solid rgba(0, 245, 255, 0.2)',
                  borderRadius: '12px',
                  marginTop: 'clamp(-0.5rem, -1vw, -0.25rem)',
                  color: '#ffffff',
                  fontSize: 'clamp(0.75rem, 2vw, 0.875rem)',
                  lineHeight: '1.6',
                  maxHeight: '250px',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  WebkitOverflowScrolling: 'touch',
                  position: 'relative'
                }}>
                  <ol style={{ paddingLeft: '1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <li style={{ fontSize: 'clamp(0.75rem, 2vw, 0.875rem)' }}>Set your stake amount using the buttons (10, 20, 50) or enter a custom amount.</li>
                    <li style={{ fontSize: 'clamp(0.75rem, 2vw, 0.875rem)' }}>Click <span style={{ color: '#ff1493', fontWeight: '600' }}>"DIP BISCUIT"</span> to start the game.</li>
                    <li style={{ fontSize: 'clamp(0.75rem, 2vw, 0.875rem)' }}>Watch the multiplier increase as the bear dips the biscuit.</li>
                    <li style={{ fontSize: 'clamp(0.75rem, 2vw, 0.875rem)' }}>Click <span style={{ color: '#ff1493', fontWeight: '600' }}>"CASH OUT"</span> before the biscuit dissolves to win your stake multiplied by the current multiplier.</li>
                    <li style={{ fontSize: 'clamp(0.75rem, 2vw, 0.875rem)' }}>If the biscuit dissolves before you cash out, you lose your stake.</li>
                    <li style={{ fontSize: 'clamp(0.75rem, 2vw, 0.875rem)' }}>Use <span style={{ color: '#ff1493', fontWeight: '600' }}>"AUTO BET"</span> to automatically cash out at a set multiplier.</li>
                  </ol>
                </div>
              )}

              {/* Expanded Bet History Content */}
              {activeMenuSection === 'Bet History' && (
                <div style={{
                  padding: 'clamp(0.75rem, 2vw, 1rem)',
                  background: 'rgba(0, 245, 255, 0.05)',
                  border: '1px solid rgba(0, 245, 255, 0.2)',
                  borderRadius: '12px',
                  marginTop: 'clamp(-0.5rem, -1vw, -0.25rem)',
                  color: '#ffffff',
                  fontSize: 'clamp(0.75rem, 2vw, 0.875rem)',
                  lineHeight: '1.6',
                  maxHeight: '250px',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  WebkitOverflowScrolling: 'touch',
                  position: 'relative'
                }}>
                  {betHistory.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 'clamp(0.75rem, 2vw, 0.875rem)', color: '#aaa', fontStyle: 'italic' }}>No bets yet. Start playing to see your history!</p>
                  ) : (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}>
                      {betHistory.map((bet) => (
                        <div
                          key={bet.id}
                          style={{
                            background: bet.result === 'WON' ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 0, 0, 0.1)',
                            border: `1px solid ${bet.result === 'WON' ? '#00ff00' : '#ff1493'}`,
                            borderRadius: '8px',
                            padding: '0.75rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '0.5rem'
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 'bold', fontSize: 'clamp(0.75rem, 2vw, 0.875rem)' }}>Stake: {bet.stake}szl</div>
                            <div style={{ fontSize: 'clamp(0.7rem, 1.8vw, 0.8rem)', color: '#aaa' }}>Multiplier: {bet.multiplier}x</div>
                            <div style={{ fontSize: 'clamp(0.65rem, 1.6vw, 0.75rem)', color: '#888' }}>{bet.timestamp}</div>
                          </div>
                          <div style={{
                            fontWeight: 'bold',
                            color: bet.result === 'WON' ? '#00ff00' : '#ff1493',
                            fontSize: 'clamp(0.75rem, 2vw, 0.875rem)'
                          }}>
                            {bet.result === 'WON' ? `+${bet.winnings.toFixed(2)}szl` : 'LOST'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Expanded Rules Content */}
              {activeMenuSection === 'Rules' && (
                <div style={{
                  padding: 'clamp(0.75rem, 2vw, 1rem)',
                  background: 'rgba(0, 245, 255, 0.05)',
                  border: '1px solid rgba(0, 245, 255, 0.2)',
                  borderRadius: '12px',
                  marginTop: 'clamp(-0.5rem, -1vw, -0.25rem)',
                  color: '#ffffff',
                  fontSize: 'clamp(0.75rem, 2vw, 0.875rem)',
                  lineHeight: '1.6',
                  maxHeight: '250px',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  WebkitOverflowScrolling: 'touch',
                  position: 'relative'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div>
                      <h3 style={{ color: '#00f5ff', marginBottom: '0.25rem', fontSize: 'clamp(0.875rem, 2.2vw, 1rem)', fontWeight: '600' }}>Objective</h3>
                      <p style={{ margin: 0, fontSize: 'clamp(0.75rem, 2vw, 0.875rem)' }}>Cash out before the biscuit dissolves to win. The longer you wait, the higher your multiplier, but the risk increases.</p>
                    </div>
                    <div>
                      <h3 style={{ color: '#00f5ff', marginBottom: '0.25rem', fontSize: 'clamp(0.875rem, 2.2vw, 1rem)', fontWeight: '600' }}>Multiplier</h3>
                      <p style={{ margin: 0, fontSize: 'clamp(0.75rem, 2vw, 0.875rem)' }}>The multiplier starts at 1.00x and increases continuously. Your winnings = Stake × Multiplier at cash out.</p>
                    </div>
                    <div>
                      <h3 style={{ color: '#00f5ff', marginBottom: '0.25rem', fontSize: 'clamp(0.875rem, 2.2vw, 1rem)', fontWeight: '600' }}>Crash Point</h3>
                      <p style={{ margin: 0, fontSize: 'clamp(0.75rem, 2vw, 0.875rem)' }}>The crash point is randomly determined. If you don't cash out before the crash, you lose your stake.</p>
                    </div>
                    <div>
                      <h3 style={{ color: '#00f5ff', marginBottom: '0.25rem', fontSize: 'clamp(0.875rem, 2.2vw, 1rem)', fontWeight: '600' }}>Auto Bet</h3>
                      <p style={{ margin: 0, fontSize: 'clamp(0.75rem, 2vw, 0.875rem)' }}>Enable Auto Bet to automatically cash out at a predetermined multiplier. You can still manually cash out before that point.</p>
                    </div>
                    <div>
                      <h3 style={{ color: '#00f5ff', marginBottom: '0.25rem', fontSize: 'clamp(0.875rem, 2.2vw, 1rem)', fontWeight: '600' }}>RTP</h3>
                      <p style={{ margin: 0, fontSize: 'clamp(0.75rem, 2vw, 0.875rem)' }}>This game has a 96% Return to Player (RTP) rate, meaning over time, players can expect to receive 96% of their total bets back as winnings.</p>
                    </div>
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
        )}
      </div>

        {/* Auto Bet Configuration Modal - Overlay on game block */}
        {autoBetModalOpen && (
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(2px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'clamp(1rem, 3vw, 2rem)',
            overflow: 'hidden',
            borderRadius: '0'
          }} onClick={() => setAutoBetModalOpen(false)}>
            <div style={{
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(10px)',
              borderRadius: '16px',
              padding: 'clamp(1.5rem, 4vw, 2.5rem)',
              maxWidth: isDesktop ? '400px' : '85%',
              width: '100%',
              border: '1px solid rgba(0, 245, 255, 0.3)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(0, 245, 255, 0.1), inset 0 0 20px rgba(0, 245, 255, 0.05)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: 'clamp(1rem, 2.5vw, 1.5rem)',
              zIndex: 102
            }} onClick={(e) => e.stopPropagation()}>
              {/* Close Button - Top Right Corner */}
              <button
                onClick={() => setAutoBetModalOpen(false)}
                style={{
                  position: 'absolute',
                  top: 'clamp(0.5rem, 1.5vw, 0.75rem)',
                  right: 'clamp(0.5rem, 1.5vw, 0.75rem)',
                  background: 'transparent',
                  border: '1px solid rgba(0, 245, 255, 0.5)',
                  borderRadius: '6px',
                  color: '#00f5ff',
                  fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
                  width: 'clamp(1.75rem, 4vw, 2rem)',
                  height: 'clamp(1.75rem, 4vw, 2rem)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 0 8px rgba(0, 245, 255, 0.3)',
                  zIndex: 103
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 245, 255, 0.5)';
                  e.currentTarget.style.borderColor = '#00f5ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 0 8px rgba(0, 245, 255, 0.3)';
                  e.currentTarget.style.borderColor = 'rgba(0, 245, 255, 0.5)';
                }}
                aria-label="Close auto bet modal"
              >
                ×
              </button>

              {/* Title */}
              <h2 style={{
                color: '#00f5ff',
                fontSize: 'clamp(1.25rem, 3vw, 1.5rem)',
                fontWeight: '700',
                margin: 0,
                textAlign: 'center',
                textShadow: '0 0 8px rgba(0, 245, 255, 0.5)'
              }}>
                Auto Bet Configuration
              </h2>

              {/* Stake Input */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'clamp(0.5rem, 1.5vw, 0.75rem)'
              }}>
                <label style={{
                  color: '#ffffff',
                  fontSize: 'clamp(0.875rem, 2.2vw, 1rem)',
                  fontWeight: '600'
                }}>
                  Stake
                </label>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'clamp(0.5rem, 1.5vw, 0.75rem)'
                }}>
                  <button
                    onClick={() => setAutoBetStake(Math.max(1, autoBetStake - 1))}
                    style={{
                      width: 'clamp(2rem, 5vw, 2.5rem)',
                      height: 'clamp(2rem, 5vw, 2.5rem)',
                      border: '1px solid rgba(0, 245, 255, 0.5)',
                      borderRadius: '8px',
                      background: 'rgba(0, 245, 255, 0.1)',
                      color: '#00f5ff',
                      fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 0 8px rgba(0, 245, 255, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(0, 245, 255, 0.2)';
                      e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 245, 255, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(0, 245, 255, 0.1)';
                      e.currentTarget.style.boxShadow = '0 0 8px rgba(0, 245, 255, 0.3)';
                    }}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={autoBetStake}
                    onChange={(e) => setAutoBetStake(Math.max(1, parseFloat(e.target.value) || 1))}
                    style={{
                      flex: 1,
                      padding: 'clamp(0.75rem, 2vw, 1rem)',
                      border: '1px solid rgba(0, 245, 255, 0.3)',
                      borderRadius: '12px',
                      background: 'rgba(0, 245, 255, 0.05)',
                      color: '#ffffff',
                      fontSize: 'clamp(0.875rem, 2.2vw, 1rem)',
                      fontWeight: '600',
                      textAlign: 'center',
                      outline: 'none',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 0 8px rgba(0, 245, 255, 0.1)'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#00f5ff';
                      e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 245, 255, 0.3)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(0, 245, 255, 0.3)';
                      e.currentTarget.style.boxShadow = '0 0 8px rgba(0, 245, 255, 0.1)';
                    }}
                  />
                  <button
                    onClick={() => setAutoBetStake(autoBetStake + 1)}
                    style={{
                      width: 'clamp(2rem, 5vw, 2.5rem)',
                      height: 'clamp(2rem, 5vw, 2.5rem)',
                      border: '1px solid rgba(0, 245, 255, 0.5)',
                      borderRadius: '8px',
                      background: 'rgba(0, 245, 255, 0.1)',
                      color: '#00f5ff',
                      fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 0 8px rgba(0, 245, 255, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(0, 245, 255, 0.2)';
                      e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 245, 255, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(0, 245, 255, 0.1)';
                      e.currentTarget.style.boxShadow = '0 0 8px rgba(0, 245, 255, 0.3)';
                    }}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Rounds Input */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'clamp(0.5rem, 1.5vw, 0.75rem)'
              }}>
                <label style={{
                  color: '#ffffff',
                  fontSize: 'clamp(0.875rem, 2.2vw, 1rem)',
                  fontWeight: '600'
                }}>
                  Rounds
                </label>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'clamp(0.5rem, 1.5vw, 0.75rem)'
                }}>
                  <button
                    onClick={() => setAutoBetRounds(Math.max(1, autoBetRounds - 1))}
                    style={{
                      width: 'clamp(2rem, 5vw, 2.5rem)',
                      height: 'clamp(2rem, 5vw, 2.5rem)',
                      border: '1px solid rgba(0, 245, 255, 0.5)',
                      borderRadius: '8px',
                      background: 'rgba(0, 245, 255, 0.1)',
                      color: '#00f5ff',
                      fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 0 8px rgba(0, 245, 255, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(0, 245, 255, 0.2)';
                      e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 245, 255, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(0, 245, 255, 0.1)';
                      e.currentTarget.style.boxShadow = '0 0 8px rgba(0, 245, 255, 0.3)';
                    }}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={autoBetRounds}
                    onChange={(e) => setAutoBetRounds(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{
                      flex: 1,
                      padding: 'clamp(0.75rem, 2vw, 1rem)',
                      border: '1px solid rgba(0, 245, 255, 0.3)',
                      borderRadius: '12px',
                      background: 'rgba(0, 245, 255, 0.05)',
                      color: '#ffffff',
                      fontSize: 'clamp(0.875rem, 2.2vw, 1rem)',
                      fontWeight: '600',
                      textAlign: 'center',
                      outline: 'none',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 0 8px rgba(0, 245, 255, 0.1)'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#00f5ff';
                      e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 245, 255, 0.3)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(0, 245, 255, 0.3)';
                      e.currentTarget.style.boxShadow = '0 0 8px rgba(0, 245, 255, 0.1)';
                    }}
                  />
                  <button
                    onClick={() => setAutoBetRounds(autoBetRounds + 1)}
                    style={{
                      width: 'clamp(2rem, 5vw, 2.5rem)',
                      height: 'clamp(2rem, 5vw, 2.5rem)',
                      border: '1px solid rgba(0, 245, 255, 0.5)',
                      borderRadius: '8px',
                      background: 'rgba(0, 245, 255, 0.1)',
                      color: '#00f5ff',
                      fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 0 8px rgba(0, 245, 255, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(0, 245, 255, 0.2)';
                      e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 245, 255, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(0, 245, 255, 0.1)';
                      e.currentTarget.style.boxShadow = '0 0 8px rgba(0, 245, 255, 0.3)';
                    }}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Auto Cashout Point Input */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'clamp(0.5rem, 1.5vw, 0.75rem)'
              }}>
                <label style={{
                  color: '#ffffff',
                  fontSize: 'clamp(0.875rem, 2.2vw, 1rem)',
                  fontWeight: '600'
                }}>
                  Auto Cashout Point
                </label>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'clamp(0.5rem, 1.5vw, 0.75rem)'
                }}>
                  <button
                    onClick={() => setAutoBetCashout(Math.max(1.0, (autoBetCashout * 10 - 1) / 10))}
                    style={{
                      width: 'clamp(2rem, 5vw, 2.5rem)',
                      height: 'clamp(2rem, 5vw, 2.5rem)',
                      border: '1px solid rgba(0, 245, 255, 0.5)',
                      borderRadius: '8px',
                      background: 'rgba(0, 245, 255, 0.1)',
                      color: '#00f5ff',
                      fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 0 8px rgba(0, 245, 255, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(0, 245, 255, 0.2)';
                      e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 245, 255, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(0, 245, 255, 0.1)';
                      e.currentTarget.style.boxShadow = '0 0 8px rgba(0, 245, 255, 0.3)';
                    }}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    value={autoBetCashout}
                    onChange={(e) => setAutoBetCashout(Math.max(1.0, parseFloat(e.target.value) || 1.0))}
                    style={{
                      flex: 1,
                      padding: 'clamp(0.75rem, 2vw, 1rem)',
                      border: '1px solid rgba(0, 245, 255, 0.3)',
                      borderRadius: '12px',
                      background: 'rgba(0, 245, 255, 0.05)',
                      color: '#ffffff',
                      fontSize: 'clamp(0.875rem, 2.2vw, 1rem)',
                      fontWeight: '600',
                      textAlign: 'center',
                      outline: 'none',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 0 8px rgba(0, 245, 255, 0.1)'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#00f5ff';
                      e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 245, 255, 0.3)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(0, 245, 255, 0.3)';
                      e.currentTarget.style.boxShadow = '0 0 8px rgba(0, 245, 255, 0.1)';
                    }}
                  />
                  <button
                    onClick={() => setAutoBetCashout((autoBetCashout * 10 + 1) / 10)}
                    style={{
                      width: 'clamp(2rem, 5vw, 2.5rem)',
                      height: 'clamp(2rem, 5vw, 2.5rem)',
                      border: '1px solid rgba(0, 245, 255, 0.5)',
                      borderRadius: '8px',
                      background: 'rgba(0, 245, 255, 0.1)',
                      color: '#00f5ff',
                      fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 0 8px rgba(0, 245, 255, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(0, 245, 255, 0.2)';
                      e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 245, 255, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(0, 245, 255, 0.1)';
                      e.currentTarget.style.boxShadow = '0 0 8px rgba(0, 245, 255, 0.3)';
                    }}
                  >
                    +
                  </button>
                </div>
                <div style={{
                  fontSize: 'clamp(0.75rem, 2vw, 0.875rem)',
                  color: '#00f5ff',
                  textAlign: 'center',
                  opacity: 0.8
                }}>
                  Cash out automatically at {autoBetCashout.toFixed(1)}x multiplier
                </div>
              </div>

              {/* Start Auto Bet Button */}
              <button
                onClick={() => {
                  setStake(autoBetStake);
                  setAutoBetRoundsRemaining(autoBetRounds);
                  setAutoPlay(true);
                  setAutoBetModalOpen(false);
                  // If game is ready, start first round immediately
                  if (gameState === 'READY' && socket) {
                    setTimeout(() => {
                      setGameState('DIPPING');
                      socket.emit('start_game', { stake: autoBetStake });
                    }, 500);
                  }
                }}
                style={{
                  width: '100%',
                  padding: 'clamp(0.75rem, 2vw, 1rem)',
                  border: '1px solid #ff1493',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #ff6b9d 0%, #c44569 100%)',
                  color: '#ffffff',
                  fontSize: 'clamp(0.875rem, 2.2vw, 1rem)',
                  fontWeight: '700',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 0 12px rgba(255, 20, 147, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 0 16px rgba(255, 20, 147, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 0 12px rgba(255, 20, 147, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                Start Auto Bet
              </button>
            </div>
          </div>
        )}

      {/* GAME CONTROLS - Full width, tidied up, seamless connection */}
      <div className="controls-container" style={{ 
        height: isDesktop ? 'auto' : 'auto',
        maxHeight: isDesktop ? 'none' : 'none',
        width: isDesktop ? '100%' : '100%',
        maxWidth: isDesktop ? '100%' : 'none', 
        backgroundColor: isDesktop ? 'rgba(0, 0, 0, 0.95)' : 'rgba(15, 23, 42, 0.85)', 
        padding: isDesktop ? 'clamp(1rem, 2.5vw, 1.5rem)' : 'clamp(0.6rem, 1.6vw, 0.8rem)', 
        borderRadius: isDesktop ? '12px' : '0',
        border: isDesktop ? '1px solid rgba(255, 20, 147, 0.5)' : 'none',
        zIndex: 1,
        backdropFilter: isDesktop ? 'blur(10px)' : 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
        gap: isDesktop ? 'clamp(0.15rem, 0.5vw, 0.25rem)' : 'clamp(0.4rem, 1.2vw, 0.6rem)',
        boxSizing: 'border-box',
        marginTop: isDesktop ? 'clamp(0.5rem, 1.5vw, 1rem)' : '0',
        overflowY: isDesktop ? 'visible' : 'auto',
        overflowX: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        justifyContent: isDesktop ? 'center' : 'flex-start',
        alignItems: isDesktop ? 'stretch' : 'stretch',
        boxShadow: isDesktop ? '0 4px 20px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(255, 20, 147, 0.3)' : 'none',
        transform: isDesktop ? 'translateX(calc(11.5% + 7cm))' : 'none'
      }}>
        {isDesktop ? (
          <>
            {/* Desktop: Stake input with +/- buttons - Mirrored from mobile */}
            <div style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 'clamp(0.4rem, 1.2vw, 0.6rem)',
              marginBottom: 'clamp(0.15rem, 0.5vw, 0.25rem)',
              marginTop: '0'
            }}>
                <button
                  onClick={() => setStake(Math.max(1, Number(stake) - 1))}
                  style={{
                    width: 'clamp(2.93rem, 6.7vw, 3.35rem)',
                    height: 'clamp(2.93rem, 6.7vw, 3.35rem)',
                    border: '1px solid #ff1493',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #40e0d0 0%, #00b8d4 100%)',
                    color: '#ffffff',
                    fontSize: 'clamp(1.00rem, 2.93vw, 1.17rem)',
                    fontWeight: '700',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(64, 224, 208, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                    transition: 'all 0.3s ease',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(64, 224, 208, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(64, 224, 208, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                  }}
                >
                  −
                </button>
                <div style={{
                  flex: '1',
                  position: 'relative',
                  border: 'none',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #40e0d0 0%, #00b8d4 100%)',
                  height: 'clamp(2.93rem, 6.7vw, 3.35rem)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 clamp(1rem, 2.5vw, 1.5rem)',
                  minWidth: 0
                }}>
        <input 
          type="number" 
          value={stake} 
          onChange={(e) => setStake(e.target.value)} 
                    placeholder=""
                    style={{ 
                      position: 'relative',
                      width: 'auto',
                      minWidth: '4ch',
                      maxWidth: '6ch',
                      padding: '0',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: 'clamp(1.00rem, 2.93vw, 1.17rem)',
                      textAlign: 'center',
                      background: 'transparent',
                      color: '#ffffff',
                      outline: 'none',
                      height: 'auto',
                      fontWeight: '700',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                      textRendering: 'optimizeLegibility',
                      WebkitFontSmoothing: 'antialiased',
                      MozOsxFontSmoothing: 'grayscale'
                    }} 
                  />
                </div>
                <button
                  onClick={() => setStake(Number(stake) + 1)}
                  style={{
                    width: 'clamp(2.93rem, 6.7vw, 3.35rem)',
                    height: 'clamp(2.93rem, 6.7vw, 3.35rem)',
                    border: '1px solid #ff1493',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #40e0d0 0%, #00b8d4 100%)',
                    color: '#ffffff',
                    fontSize: 'clamp(1.00rem, 2.93vw, 1.17rem)',
                    fontWeight: '700',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(64, 224, 208, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                    transition: 'all 0.3s ease',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(64, 224, 208, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(64, 224, 208, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                  }}
                >
                  +
                </button>
              </div>
              
            {/* Desktop: Quick bet buttons row - Mirrored from mobile */}
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              gap: 'clamp(0.3rem, 0.9vw, 0.5rem)',
              width: '100%',
              marginBottom: 'clamp(0.15rem, 0.5vw, 0.25rem)'
            }}>
                <button
                  onClick={() => setStake(10)}
                  style={{
                    flex: '1',
                    border: '1px solid #ff1493',
                    borderRadius: '12px',
                    background: stake === 10 ? 'linear-gradient(135deg, #ff6b9d 0%, #c44569 100%)' : 'linear-gradient(135deg, #40e0d0 0%, #00b8d4 100%)',
                    height: 'clamp(2.93rem, 6.7vw, 3.35rem)',
                    fontSize: 'clamp(1.00rem, 2.93vw, 1.17rem)',
                    fontWeight: '700',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    color: '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: stake === 10 ? '0 4px 12px rgba(255, 107, 157, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)' : '0 4px 12px rgba(64, 224, 208, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                    textRendering: 'optimizeLegibility',
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale'
                  }}
                  onMouseEnter={(e) => {
                    if (stake !== 10) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(64, 224, 208, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (stake !== 10) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(64, 224, 208, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                    }
                  }}
                >
                  10
                </button>
                <button
                  onClick={() => setStake(20)}
                  style={{
                    flex: '1',
                    border: '1px solid #ff1493',
                    borderRadius: '12px',
                    background: stake === 20 ? 'linear-gradient(135deg, #ff6b9d 0%, #c44569 100%)' : 'linear-gradient(135deg, #40e0d0 0%, #00b8d4 100%)',
                    height: 'clamp(2.93rem, 6.7vw, 3.35rem)',
                    fontSize: 'clamp(1.00rem, 2.93vw, 1.17rem)',
                    fontWeight: '700',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    color: '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: stake === 20 ? '0 4px 12px rgba(255, 107, 157, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)' : '0 4px 12px rgba(64, 224, 208, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                    textRendering: 'optimizeLegibility',
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale'
                  }}
                  onMouseEnter={(e) => {
                    if (stake !== 20) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(64, 224, 208, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (stake !== 20) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(64, 224, 208, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                    }
                  }}
                >
                  20
                </button>
                <button
                  onClick={() => setStake(50)}
                  style={{
                    flex: '1',
                    border: '1px solid #ff1493',
                    borderRadius: '12px',
                    background: stake === 50 ? 'linear-gradient(135deg, #ff6b9d 0%, #c44569 100%)' : 'linear-gradient(135deg, #40e0d0 0%, #00b8d4 100%)',
                    height: 'clamp(2.93rem, 6.7vw, 3.35rem)',
                    fontSize: 'clamp(1.00rem, 2.93vw, 1.17rem)',
                    fontWeight: '700',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    color: '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: stake === 50 ? '0 4px 12px rgba(255, 107, 157, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)' : '0 4px 12px rgba(64, 224, 208, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                    textRendering: 'optimizeLegibility',
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale'
                  }}
                  onMouseEnter={(e) => {
                    if (stake !== 50) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(64, 224, 208, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (stake !== 50) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(64, 224, 208, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                    }
                  }}
                >
                  50
                </button>
              </div>
              
              {/* Desktop: Large BET button - Mirrored from mobile */}
        {gameState === 'DIPPING' ? (
                <button onClick={cashOut} className="game-button" style={{ 
                  width: '100%',
                  background: 'linear-gradient(135deg, #ff6b9d 0%, #c44569 100%)',
                  height: 'clamp(2.93rem, 6.7vw, 3.35rem)', 
                  borderRadius: '12px', 
                  cursor: 'pointer', 
                  border: '1px solid #ff1493',
                  fontSize: 'clamp(1.00rem, 2.93vw, 1.17rem)',
                  fontWeight: '700',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#ffffff',
                  textRendering: 'optimizeLegibility',
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale',
                  boxShadow: '0 6px 20px rgba(255, 107, 157, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                  transition: 'all 0.3s ease',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                  marginBottom: 'clamp(0.25rem, 0.8vw, 0.4rem)',
                  padding: '0'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(255, 107, 157, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 107, 157, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                }}
              >
                  CASH OUT
                </button>
              ) : (
                <button onClick={startDip} className="game-button dip-button" style={{ 
                  width: '100%',
                  background: 'linear-gradient(135deg, #40e0d0 0%, #00b8d4 100%)',
                  height: 'clamp(2.93rem, 6.7vw, 3.35rem)', 
                  borderRadius: '12px', 
                  cursor: 'pointer', 
                  border: '1px solid #ff1493',
                  fontSize: 'clamp(1.00rem, 2.93vw, 1.17rem)',
                  fontWeight: '700',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#ffffff',
                  textRendering: 'optimizeLegibility',
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale',
                  boxShadow: '0 6px 20px rgba(64, 224, 208, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                  transition: 'all 0.3s ease',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                  marginBottom: 'clamp(0.25rem, 0.8vw, 0.4rem)',
                  padding: '0'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(64, 224, 208, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(64, 224, 208, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                }}
              >
                  DIP BISCUIT
                </button>
              )}
              
              {/* Desktop: AUTO BET button - Mirrored from mobile */}
              <button
                onClick={() => setAutoBetModalOpen(true)}
                className="game-button auto-bet-button"
                style={{
                  width: '100%',
                  background: autoPlay ? 'linear-gradient(135deg, #ff6b9d 0%, #c44569 100%)' : 'linear-gradient(135deg, #40e0d0 0%, #00b8d4 100%)',
                  border: '1px solid #ff1493',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.3s ease',
                  height: 'clamp(3.15rem, 7.2vw, 3.6rem)',
                  fontSize: 'clamp(1.08rem, 3.15vw, 1.26rem)',
                  fontWeight: '700',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#ffffff',
                  textRendering: 'optimizeLegibility',
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale',
                  boxShadow: autoPlay ? '0 6px 20px rgba(255, 107, 157, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)' : '0 6px 20px rgba(64, 224, 208, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                  padding: '0'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  const shadowColor = autoPlay ? 'rgba(255, 107, 157, 0.5)' : 'rgba(64, 224, 208, 0.5)';
                  e.currentTarget.style.boxShadow = `0 8px 24px ${shadowColor}, inset 0 1px 0 rgba(255, 255, 255, 0.3)`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  const shadowColor = autoPlay ? 'rgba(255, 107, 157, 0.4)' : 'rgba(64, 224, 208, 0.4)';
                  e.currentTarget.style.boxShadow = `0 6px 20px ${shadowColor}, inset 0 1px 0 rgba(255, 255, 255, 0.3)`;
                }}
              >
                AUTO BET
              </button>
          </>
        ) : (
          <>
            {/* Mobile: Stake selection row */}
            <div className="stake-row" style={{
              display: 'flex',
              flexDirection: 'row',
              gap: 'clamp(0.5rem, 1.5vw, 0.75rem)',
              alignItems: 'center',
              width: 'auto',
              margin: '0',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              {/* Mobile: Stake input with +/- buttons - 20% smaller */}
              <div style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 'clamp(0.4rem, 1.2vw, 0.6rem)',
                marginBottom: 'clamp(0.4rem, 1.2vw, 0.6rem)'
              }}>
                <button
                  onClick={() => setStake(Math.max(1, Number(stake) - 1))}
                  style={{
                    width: 'clamp(2rem, 4.8vw, 2.4rem)',
                    height: 'clamp(2rem, 4.8vw, 2.4rem)',
                    border: '1px solid #ff1493',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #40e0d0 0%, #00b8d4 100%)',
                    color: '#ffffff',
                    fontSize: 'clamp(1rem, 2.8vw, 1.2rem)',
                    fontWeight: '700',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(64, 224, 208, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
                  }}
                >
                  −
                </button>
                <div style={{
                  flex: '1',
                  position: 'relative',
                  border: '1px solid #ff1493',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #40e0d0 0%, #00b8d4 100%)',
                  height: 'clamp(2rem, 4.8vw, 2.4rem)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
        <input 
          type="number" 
          value={stake} 
          onChange={(e) => setStake(e.target.value)} 
                    placeholder=""
                    style={{ 
                      width: '100%',
                      padding: '0 clamp(0.4rem, 1.2vw, 0.6rem)',
                      border: 'none',
                      borderRadius: '12px',
                      fontSize: 'clamp(0.8rem, 2vw, 1rem)',
                      textAlign: 'center',
                      background: 'transparent',
                      color: '#ffffff',
                      outline: 'none',
                      height: '100%',
                      fontWeight: '700',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                      textRendering: 'optimizeLegibility',
                      WebkitFontSmoothing: 'antialiased',
                      MozOsxFontSmoothing: 'grayscale'
                    }} 
                  />
      </div>
                <button
                  onClick={() => setStake(Number(stake) + 1)}
                  style={{
                    width: 'clamp(2rem, 4.8vw, 2.4rem)',
                    height: 'clamp(2rem, 4.8vw, 2.4rem)',
                    border: '1px solid #ff1493',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #40e0d0 0%, #00b8d4 100%)',
                    color: '#ffffff',
                    fontSize: 'clamp(1rem, 2.8vw, 1.2rem)',
                    fontWeight: '700',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(64, 224, 208, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
                  }}
                >
                  +
                </button>
    </div>
              
              {/* Mobile: Quick bet buttons row - 20% smaller - directly under stake input */}
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                gap: 'clamp(0.4rem, 1.2vw, 0.6rem)',
                width: '100%',
                marginBottom: 'clamp(0.4rem, 1.2vw, 0.6rem)'
              }}>
                <button
                  onClick={() => setStake(10)}
                  style={{
                    flex: '1',
                    border: '1px solid #ff1493',
                    borderRadius: '12px',
                    background: stake === 10 ? 'rgba(255, 255, 255, 0.3)' : 'linear-gradient(135deg, #40e0d0 0%, #00b8d4 100%)',
                    height: 'clamp(1.6rem, 4vw, 2rem)',
                    fontSize: 'clamp(0.7rem, 2vw, 0.88rem)',
                    fontWeight: '700',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    color: '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  10
                </button>
                <button
                  onClick={() => setStake(20)}
                  style={{
                    flex: '1',
                    border: '1px solid #ff1493',
                    borderRadius: '12px',
                    background: stake === 20 ? 'rgba(255, 255, 255, 0.3)' : 'linear-gradient(135deg, #40e0d0 0%, #00b8d4 100%)',
                    height: 'clamp(1.6rem, 4vw, 2rem)',
                    fontSize: 'clamp(0.7rem, 2vw, 0.88rem)',
                    fontWeight: '700',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    color: '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  20
                </button>
                <button
                  onClick={() => setStake(50)}
                  style={{
                    flex: '1',
                    border: '1px solid #ff1493',
                    borderRadius: '12px',
                    background: stake === 50 ? 'rgba(255, 255, 255, 0.3)' : 'linear-gradient(135deg, #40e0d0 0%, #00b8d4 100%)',
                    height: 'clamp(1.6rem, 4vw, 2rem)',
                    fontSize: 'clamp(0.7rem, 2vw, 0.88rem)',
                    fontWeight: '700',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    color: '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  50
                </button>
              </div>
            </div>
            {/* End stake-row */}
              
              {/* Mobile: Large BET button - 20% smaller */}
        {gameState === 'DIPPING' ? (
                <button onClick={cashOut} className="game-button" style={{ 
                  width: '100%',
                  background: 'linear-gradient(135deg, #ff6b9d 0%, #c44569 100%)',
                  height: 'clamp(2.8rem, 6.4vw, 3.6rem)', 
                  borderRadius: '12px', 
                  cursor: 'pointer', 
                  border: '1px solid #ff1493',
                  fontSize: 'clamp(1rem, 2.8vw, 1.2rem)',
                  fontWeight: '700',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#ffffff',
                  textRendering: 'optimizeLegibility',
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale',
                  boxShadow: '0 6px 20px rgba(255, 107, 157, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                  transition: 'all 0.3s ease',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                  marginBottom: 'clamp(0.4rem, 1.2vw, 0.6rem)'
                }}>
                  CASH OUT
                </button>
              ) : (
                <button onClick={startDip} className="game-button dip-button" style={{ 
                  width: '100%',
                  background: 'linear-gradient(135deg, #40e0d0 0%, #00b8d4 100%)',
                  height: 'clamp(2.8rem, 6.4vw, 3.6rem)', 
                  borderRadius: '12px', 
                  cursor: 'pointer', 
                  border: '1px solid #ff1493',
                  fontSize: 'clamp(1rem, 2.8vw, 1.2rem)',
                  fontWeight: '700',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#ffffff',
                  textRendering: 'optimizeLegibility',
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale',
                  boxShadow: '0 6px 20px rgba(64, 224, 208, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                  transition: 'all 0.3s ease',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                  marginBottom: 'clamp(0.4rem, 1.2vw, 0.6rem)'
                }}>
                  DIP BISCUIT
                </button>
              )}
              
              {/* Mobile: AUTO BET button - 20% smaller */}
              <button
                onClick={() => setAutoBetModalOpen(true)}
                className="game-button auto-bet-button"
                style={{
                  width: '100%',
                  background: autoPlay ? 'linear-gradient(135deg, #ff6b9d 0%, #c44569 100%)' : 'linear-gradient(135deg, #40e0d0 0%, #00b8d4 100%)',
                  border: '1px solid #ff1493',
                  borderRadius: '12px',
                  padding: 'clamp(0.4rem, 1.2vw, 0.6rem)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.3s ease',
                  height: 'clamp(2rem, 4.8vw, 2.4rem)',
                  fontSize: 'clamp(0.8rem, 2vw, 0.9rem)',
                  fontWeight: '700',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#ffffff',
                  textRendering: 'optimizeLegibility',
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale',
                  boxShadow: autoPlay ? '0 6px 20px rgba(255, 107, 157, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)' : '0 6px 20px rgba(64, 224, 208, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
                }}
              >
                AUTO BET
              </button>
            </> 
          )}
      </div>
      {/* End controls-container */}
      </div>
      {/* End game-wrapper */}
      </div>
      {/* End main-container */}
    </>
  );
}

export default App;
