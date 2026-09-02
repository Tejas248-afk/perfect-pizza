window.LocationUtil = (function () {
  // Browser se GPS
  function getCurrentPosition(options = {}) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(
          new Error('Browser me location permission available nahi hai.')
        );
      }

      navigator.geolocation.getCurrentPosition(
        pos => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          });
        },
        err => {
          let msg = 'Location fetch nahi ho paayi.';
          if (err.code === err.PERMISSION_DENIED) {
            msg =
              'Location permission deny kar di gayi. Address manually daalein ya permission allow karein.';
          }
          reject(new Error(msg));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
          ...options
        }
      );
    });
  }

  // OpenStreetMap Nominatim – raw display_name + city/area
  async function reverseGeocode(latitude, longitude) {
    try {
      if (
        typeof latitude !== 'number' ||
        Number.isNaN(latitude) ||
        typeof longitude !== 'number' ||
        Number.isNaN(longitude)
      ) {
        return null;
      }

      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`;

      const res = await fetch(url, {
        headers: {
          Accept: 'application/json'
        }
      });

      if (!res.ok) {
        console.warn('Reverse geocode HTTP error', res.status);
        return null;
      }

      const data = await res.json();
      const addr = data.address || {};

      const area =
        addr.neighbourhood ||
        addr.suburb ||
        addr.village ||
        addr.town ||
        '';
      const city = addr.city || addr.town || addr.village || addr.state || '';

      return {
        fullAddress: data.display_name || '',
        area,
        city
      };
    } catch (err) {
      console.error('reverseGeocode error:', err);
      return null;
    }
  }

  return { getCurrentPosition, reverseGeocode };
})();